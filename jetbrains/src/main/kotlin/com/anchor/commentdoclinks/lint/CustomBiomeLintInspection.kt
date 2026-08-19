package com.anchor.commentdoclinks.lint

import com.intellij.codeInspection.InspectionManager
import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.LocalQuickFix
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.codeInspection.ProblemHighlightType
import com.intellij.codeInspection.ProblemsHolder
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Document
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile

/**
 * JetBrains/WebStorm lint integration for `custom-biome-lint` (v1 protocol).
 *
 * Consumes the SAME Rust JSON contract used by the VS Code extension. The
 * Rust linter stays the single source of truth for what is wrong and how it
 * is fixed; this inspection only turns the result into native highlights,
 * quick fixes and suppression actions.
 *
 * Only JavaScript/JSX files are linted. When the package is not installed
 * the inspection is a silent no-op (no errors, no notifications). The
 * IntelliJ platform already debounces re-runs on edits and shows only the
 * latest result, so no extra stale-result handling is needed here.
 */
class CustomBiomeLintInspection : LocalInspectionTool() {
    override fun getDisplayName(): String = "Custom Biome Lint"

    override fun getShortName(): String = "CustomBiomeLint"

    override fun isEnabledByDefault(): Boolean = true

    override fun checkFile(
        file: PsiFile,
        manager: InspectionManager,
        isOnTheFly: Boolean,
    ): Array<ProblemDescriptor> {
        val language = file.language.id
        if (language != "JavaScript" && language != "JavaScript JSX" && language != "ECMAScript") {
            return emptyArray()
        }

        val virtualFile = file.virtualFile ?: return emptyArray()
        val install = CustomBiomeLintService.findInstall(virtualFile.path) ?: return emptyArray()
        val document = file.viewProvider.document ?: return emptyArray()
        val text = document.text

        val result =
            try {
                CustomBiomeLintService.runLint(
                    install.executable,
                    virtualFile.path,
                    install.workspaceDir,
                    text,
                )
            } catch (_: Exception) {
                return emptyArray()
            }

        val byteIndex = ByteOffsetConverter.byteIndexByChar(text)
        val holder = ProblemsHolder(manager, file, isOnTheFly)

        for (lintFile in result.files) {
            for (violation in lintFile.violations) {
                val range = violationRange(document, text, byteIndex, violation) ?: continue
                val highlight =
                    if (violation.severity == "warning") {
                        ProblemHighlightType.WARNING
                    } else {
                        ProblemHighlightType.ERROR
                    }

                val fixes = mutableListOf<LocalQuickFix>()
                val fixEdits = violation.fixes.flatMap { it.edits }
                if (fixEdits.isNotEmpty()) {
                    val title = violation.fixes.firstNotNullOfOrNull { it.title }
                        ?: "Fix ${violation.rule}"
                    fixes.add(LintQuickFix(title, fixEdits))
                }
                val suppressEdits = violation.suppressions.flatMap { it.edits }
                if (suppressEdits.isNotEmpty()) {
                    fixes.add(LintQuickFix("Suppress ${violation.rule}", suppressEdits))
                }

                holder.registerProblem(
                    file,
                    buildDescription(violation),
                    highlight,
                    range,
                    *fixes.toTypedArray(),
                )
            }
        }

        return holder.results.toTypedArray()
    }

    private fun buildDescription(violation: LintViolation): String {
        val base = "${violation.message}\n\ncustom-biome-lint/${violation.rule}"
        return base
    }

    /**
     * Map a violation's contract coordinates to an IntelliJ [TextRange].
     * Byte columns are converted to char offsets via [ByteOffsetConverter].
     * Line-only rules (no `endLine`/`endColumn`) highlight the whole line.
     */
    private fun violationRange(
        document: Document,
        text: String,
        byteIndex: LongArray,
        violation: LintViolation,
    ): TextRange? {
        val startLineNo = (violation.startLine ?: violation.line ?: 1)
        val startCol = (violation.startColumn ?: violation.col ?: 1)
        val endLineNo = violation.endLine ?: startLineNo
        val hasEndCol = violation.endColumn != null
        val endCol = violation.endColumn ?: 1

        val sLine = (startLineNo - 1).coerceAtLeast(0)
        val eLine = (endLineNo - 1).coerceAtLeast(0)
        if (sLine >= document.lineCount || eLine >= document.lineCount) return null

        val sStart = document.getLineStartOffset(sLine)
        val sEnd = document.getLineEndOffset(sLine)
        val eStart = document.getLineStartOffset(eLine)
        val eEnd = document.getLineEndOffset(eLine)

        val startOffset =
            ByteOffsetConverter.toCharOffset(text, byteIndex, sStart, sEnd, startLineNo, startCol)
                ?: return null
        val endOffset =
            if (hasEndCol) {
                ByteOffsetConverter.toCharOffset(text, byteIndex, eStart, eEnd, endLineNo, endCol)
                    ?: return null
            } else {
                eEnd
            }

        if (startOffset > endOffset) return null
        return TextRange(startOffset, endOffset)
    }
}

/**
 * Applies exactly the text edits the Rust linter supplied — never computes
 * placement itself. Each edit's byte-column coordinates are converted to
 * Document offsets, then all edits are applied in a single write command,
 * ordered back-to-front so earlier offsets stay valid.
 */
class LintQuickFix(
    private val family: String,
    private val edits: List<LintEdit>,
) : LocalQuickFix {
    override fun getFamilyName(): String = family

    override fun getName(): String = family

    override fun applyFix(
        project: Project,
        descriptor: ProblemDescriptor,
    ) {
        val psi: PsiElement = descriptor.psiElement ?: return
        val document = psi.containingFile?.viewProvider?.document ?: return
        val text = document.text
        val byteIndex = ByteOffsetConverter.byteIndexByChar(text)

        val offsets =
            edits.mapNotNull { edit ->
                val sLine = (edit.startLine - 1).coerceAtLeast(0)
                val eLine = (edit.endLine - 1).coerceAtLeast(0)
                if (sLine >= document.lineCount || eLine >= document.lineCount) return@mapNotNull null

                val sStart = document.getLineStartOffset(sLine)
                val sEnd = document.getLineEndOffset(sLine)
                val eStart = document.getLineStartOffset(eLine)
                val eEnd = document.getLineEndOffset(eLine)

                val start =
                    ByteOffsetConverter.toCharOffset(text, byteIndex, sStart, sEnd, edit.startLine, edit.startColumn)
                        ?: return@mapNotNull null
                val end =
                    ByteOffsetConverter.toCharOffset(text, byteIndex, eStart, eEnd, edit.endLine, edit.endColumn)
                        ?: return@mapNotNull null
                EditOffset(start, end, edit.replacement)
            }

        // All-or-nothing: if any supplied edit is out of range, skip the whole
        // fix rather than mutating the document into an inconsistent state.
        if (offsets.any { it.start > it.end } || offsets.isEmpty()) return

        WriteCommandAction.runWriteCommandAction(project) {
            for (offset in offsets.sortedByDescending { it.start }) {
                document.replaceString(offset.start, offset.end, offset.text)
            }
        }
    }

    private data class EditOffset(
        val start: Int,
        val end: Int,
        val text: String,
    )
}
