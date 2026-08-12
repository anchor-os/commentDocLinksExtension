package com.anchor.commentdoclinks.decorations

import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.model.ResolutionStatus
import com.anchor.commentdoclinks.model.stringDocument
import com.anchor.commentdoclinks.parser.getLanguageIdFromExtension
import com.anchor.commentdoclinks.parser.scanDocumentForReferences
import com.anchor.commentdoclinks.resolver.FileSystemLike
import com.anchor.commentdoclinks.resolver.hasExactSourceReference
import com.anchor.commentdoclinks.resolver.parseMarkdownHeading
import com.anchor.commentdoclinks.resolver.resolveInRoot
import com.anchor.commentdoclinks.resolver.validateReference
import com.anchor.commentdoclinks.resolver.workspaceRelativePath
import com.anchor.commentdoclinks.services.VfsFileSystem
import com.anchor.commentdoclinks.services.WorkspaceRootService
import com.anchor.commentdoclinks.services.documentLikeFromDocument
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile

/**
 * Text attributes key for navigable (valid + external) references. Inherits the
 * doc-comment tag-value color by default; configurable later via a color
 * settings page bound to [LINK_KEY].
 */
val LINK_KEY: TextAttributesKey =
    TextAttributesKey.createTextAttributesKey(
        "COMMENT_DOC_LINKS_LINK",
        DefaultLanguageHighlighterColors.DOC_COMMENT_TAG_VALUE
    )

/**
 * Colors references by resolution status and reports broken ones as
 * diagnostics.
 *
 * - Valid documentation + external references: link-colored (silent).
 * - Missing file / invalid path: ERROR with the §9 message.
 * - Missing anchor / invalid line: WARNING with the §9 message.
 *
 * Scans the whole file (filtered to supported languages), mirroring the single
 * shared scan used by navigation and diagnostics in the VS Code extension.
 */
class CommentDocLinkAnnotator : Annotator {
    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        if (element !is PsiFile) return
        val virtualFile = element.virtualFile ?: return
        val languageId = languageIdFromVirtualFile(virtualFile) ?: return
        val document = element.viewProvider.document ?: return
        val root = WorkspaceRootService(element.project).resolveWorkspaceRoot(virtualFile) ?: return
        val doc = documentLikeFromDocument(document)
        val fs = VfsFileSystem()

        for ((reference, _) in scanDocumentForReferences(doc, languageId)) {
            val result = validateReference(reference, { resolveInRoot(root, it) }, fs)
            val range = TextRange(reference.start, reference.end)

            when (result.status) {
                ResolutionStatus.VALID, ResolutionStatus.EXTERNAL -> {
                    holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
                        .range(range)
                        .textAttributes(LINK_KEY)
                        .create()
                }

                ResolutionStatus.MISSING_FILE, ResolutionStatus.INVALID_PATH -> {
                    holder.newAnnotation(HighlightSeverity.ERROR, result.message ?: "Broken documentation reference")
                        .range(range)
                        .create()
                }

                ResolutionStatus.MISSING_ANCHOR, ResolutionStatus.INVALID_LINE -> {
                    holder.newAnnotation(HighlightSeverity.WARNING, result.message ?: "Broken documentation reference")
                        .range(range)
                        .create()
                }
            }
        }

        if (languageId == "markdown") {
            annotateMarkdownSourceReferences(element, document, root, fs, holder)
        }
    }

    /**
     * Diagnostics for `## src/file.js — anchor` headings in Markdown docs:
     * missing source file → ERROR; missing source anchor → WARNING. Mirrors
     * `collectBrokenMarkdownReferences` in `src/diagnostics/brokenReferenceScanner.js`.
     */
    private fun annotateMarkdownSourceReferences(
        file: PsiFile,
        document: com.intellij.openapi.editor.Document,
        root: String,
        fs: VfsFileSystem,
        holder: AnnotationHolder
    ) {
        val documentationFile = workspaceRelativePath(file.virtualFile?.path ?: return, root) ?: return

        for (diag in markdownSourceDiagnostics(documentLikeFromDocument(document), root, fs, documentationFile)) {
            val lineStart = document.getLineStartOffset(diag.line)
            holder.newAnnotation(diag.severity, diag.message)
                .range(TextRange(lineStart + diag.range.startOffset, lineStart + diag.range.endOffset))
                .create()
        }
    }
}

/**
 * Pure, testable computation behind [CommentDocLinkAnnotator] markdown
 * diagnostics. For each `## src/file.js — anchor` heading, reports a missing
 * source file (ERROR) or a missing source anchor (WARNING). Ranges are
 * line-relative; callers shift them by the line's start offset.
 */
internal data class MarkdownSourceDiagnostic(
    val line: Int,
    val range: TextRange,
    val severity: HighlightSeverity,
    val message: String
)

internal fun markdownSourceDiagnostics(
    doc: DocumentLike,
    root: String,
    fs: FileSystemLike,
    documentationFile: String
): List<MarkdownSourceDiagnostic> {
    val result = mutableListOf<MarkdownSourceDiagnostic>()
    // One pass may reference the same source file from many headings; cache the
    // read + language so we don't hit the VFS repeatedly (avoids N reads of one
    // file on a single annotation pass).
    val sourceCache = mutableMapOf<String, Pair<String, String>?>()
    for (line in 0 until doc.lineCount) {
        val lineText = doc.lineAt(line)
        val heading = parseMarkdownHeading(lineText) ?: continue

        val targetPath = resolveInRoot(root, heading.source)
        val range = TextRange(heading.start, heading.end)

        if (targetPath == null || !fs.exists(targetPath)) {
            result.add(
                MarkdownSourceDiagnostic(
                    line,
                    range,
                    HighlightSeverity.ERROR,
                    "Source file not found: ${heading.source}"
                )
            )
            continue
        }

        val cached = sourceCache.getOrPut(targetPath) {
            val text = fs.readText(targetPath) ?: return@getOrPut null
            val languageId = getLanguageIdFromExtension(targetPath.substringAfterLast('/')) ?: return@getOrPut null
            text to languageId
        } ?: continue

        val (sourceText, sourceLanguageId) = cached
        if (heading.anchor.isEmpty() || sourceLanguageId == "markdown") continue

        if (!hasExactSourceReference(stringDocument(sourceText), sourceLanguageId, documentationFile, heading.anchor)) {
            result.add(
                MarkdownSourceDiagnostic(
                    line,
                    range,
                    HighlightSeverity.WARNING,
                    "Source anchor not found: ${heading.anchor}"
                )
            )
        }
    }
    return result
}
