package com.anchor.commentdoclinks.completion

import com.anchor.commentdoclinks.config.CommentDocLinksConfig
import com.anchor.commentdoclinks.model.stringDocument
import com.anchor.commentdoclinks.parser.CommentScannerState
import com.anchor.commentdoclinks.parser.getCommentRanges
import com.anchor.commentdoclinks.parser.getLanguageIdFromExtension
import com.anchor.commentdoclinks.resolver.FileSystemLike
import com.anchor.commentdoclinks.resolver.listAnchors
import com.anchor.commentdoclinks.resolver.listSourceAnchors
import com.anchor.commentdoclinks.resolver.resolveInRoot
import com.anchor.commentdoclinks.resolver.workspaceRelativePath
import com.anchor.commentdoclinks.services.VfsFileSystem
import com.anchor.commentdoclinks.services.WorkspaceRootService
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.openapi.editor.Document
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiFile
import com.intellij.util.ProcessingContext

/**
 * Completion inside source comments and Markdown source-heading lines.
 *
 *  - After `file.md#` inside a supported comment, suggests anchors defined in
 *    that documentation file.
 *  - After `## src/file.js — ` inside a Markdown document, suggests anchors
 *    referenced by comments in that source file.
 *
 * Mirrors `src/completion/completionProvider.js`.
 */
class ReferenceCompletionContributor : CompletionContributor() {
    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet
                ) {
                    if (!CommentDocLinksConfig.enableCompletion) return

                    val file = parameters.originalFile
                    val virtualFile = file.virtualFile ?: return
                    val languageId = languageIdFromVirtualFile(virtualFile) ?: return
                    val document = file.viewProvider.document ?: return
                    val caret = parameters.offset

                    val line = document.getLineNumber(caret)
                    val lineStart = document.getLineStartOffset(line)
                    val lineEnd = document.getLineEndOffset(line)
                    val fullLine = document.getText(TextRange(lineStart, lineEnd))
                    val caretInLine = caret - lineStart

                    val root = WorkspaceRootService(file.project).resolveWorkspaceRoot(virtualFile) ?: return
                    val fs = VfsFileSystem()

                    if (languageId == "markdown") {
                        for (variant in suggestSourceAnchorCompletions(
                            fullLine.substring(0, caretInLine),
                            virtualFile.path,
                            root,
                            fs
                        )) {
                            result.addElement(LookupElementBuilder.create(variant))
                        }
                        return
                    }

                    val state = commentStateBefore(document, line, languageId)
                    val comment = commentTextUpTo(fullLine, caretInLine, languageId, state) ?: return
                    for (variant in suggestDocAnchorCompletions(comment.text, root, fs)) {
                        result.addElement(LookupElementBuilder.create(variant))
                    }
                }
            }
        )
    }

    private fun commentStateBefore(
        document: Document,
        lineIndex: Int,
        languageId: String
    ): CommentScannerState {
        val state = CommentScannerState()
        for (i in 0 until lineIndex) {
            val lineText = document.getText(
                TextRange(document.getLineStartOffset(i), document.getLineEndOffset(i))
            )
            getCommentRanges(languageId, lineText, state)
        }
        return state
    }

    private fun commentTextUpTo(
        line: String,
        character: Int,
        languageId: String,
        state: CommentScannerState
    ): CommentUpTo? {
        for (range in getCommentRanges(languageId, line, state)) {
            if (character > range.start && character <= range.end) {
                return CommentUpTo(line.substring(range.start, character), range.start)
            }
        }
        return null
    }

    private data class CommentUpTo(val text: String, val offset: Int)

    companion object {
        private fun languageIdFromVirtualFile(path: String): String? =
            LocalFileSystem.getInstance().findFileByPath(path)?.let { languageIdFromVirtualFile(it) }
    }
}

/** Matches a `file.md#anchor` reference at the end of a comment substring. */
internal val ANCHOR_REFERENCE_REGEX = Regex("""([A-Za-z0-9_./\\-]+\.md)#([A-Za-z0-9_-]*)$""")

/** Matches a `## src/file.js — ` heading prefix being typed in Markdown. */
internal val HEADING_REFERENCE_REGEX = Regex("""^#{2,}\s+(.+?)\s+[—\-]\s*$""")

/**
 * Suggest documentation anchors after `file.md#` in a comment. Pure/testable;
 * the contributor supplies the comment substring up to the caret.
 */
internal fun suggestDocAnchorCompletions(
    commentTextUpToCaret: String,
    root: String,
    fs: FileSystemLike
): List<String> {
    val match = ANCHOR_REFERENCE_REGEX.find(commentTextUpToCaret) ?: return emptyList()
    val file = match.groupValues[1]
    val absolute = resolveInRoot(root, file) ?: return emptyList()
    val text = fs.readText(absolute) ?: return emptyList()
    return listAnchors(stringDocument(text))
}

/**
 * Suggest source anchors after `## src/file.js — ` in a Markdown heading.
 * Pure/testable; the contributor supplies the heading prefix up to the caret.
 */
internal fun suggestSourceAnchorCompletions(
    headingPrefix: String,
    markdownPath: String,
    root: String,
    fs: FileSystemLike
): List<String> {
    val match = HEADING_REFERENCE_REGEX.find(headingPrefix) ?: return emptyList()
    val source = match.groupValues[1]
    val absolute = resolveInRoot(root, source) ?: return emptyList()
    val text = fs.readText(absolute) ?: return emptyList()
    val sourceLanguageId = getLanguageIdFromExtension(absolute.substringAfterLast('/')) ?: return emptyList()
    val documentationFile = workspaceRelativePath(markdownPath, root) ?: return emptyList()
    return listSourceAnchors(stringDocument(text), sourceLanguageId, documentationFile)
}
