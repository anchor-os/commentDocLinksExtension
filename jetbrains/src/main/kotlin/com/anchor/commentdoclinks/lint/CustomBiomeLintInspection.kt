package com.anchor.commentdoclinks.lint

import com.intellij.codeInspection.InspectionManager
import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.LocalQuickFix
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.codeInspection.ProblemHighlightType
import com.intellij.codeInspection.ProblemsHolder
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile

/**
 * JetBrains/WebStorm lint integration for `custom-biome-lint`.
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

        val result =
            try {
                CustomBiomeLintService.runLint(install.executable, virtualFile.path, install.workspaceDir)
            } catch (_: Exception) {
                return emptyArray()
            }

        val holder = ProblemsHolder(manager, file, isOnTheFly)

        for (diagnostic in result.diagnostics) {
            val range = toRange(document, diagnostic.range) ?: continue
            val highlight =
                if (diagnostic.severity == "warn") {
                    ProblemHighlightType.WARNING
                } else {
                    ProblemHighlightType.ERROR
                }

            val fixes = mutableListOf<LocalQuickFix>()
            diagnostic.fix?.let { fix ->
                if (fix.edits.isNotEmpty()) {
                    fixes.add(LintQuickFix(if (fix.title.isBlank()) "Apply safe fix" else fix.title, fix.edits))
                }
            }
            diagnostic.suppression?.let { suppression ->
                if (suppression.edits.isNotEmpty()) {
                    fixes.add(LintQuickFix("Suppress ${diagnostic.rule}", suppression.edits))
                }
            }

            holder.registerProblem(
                file,
                buildDescription(diagnostic),
                highlight,
                range,
                *fixes.toTypedArray(),
            )
        }

        return holder.results.toTypedArray()
    }

    private fun buildDescription(diagnostic: LintDiagnostic): String {
        val url = diagnostic.docsUrl ?: RuleDocumentation.urlFor(diagnostic.rule)
        val base = "${diagnostic.message}\n\ncustom-biome-lint/${diagnostic.rule}"
        return if (url != null) "$base\n\n$url" else base
    }

    private fun toRange(
        document: com.intellij.openapi.editor.Document,
        range: LintRange,
    ): TextRange? {
        val startLine = (range.start.line - 1).coerceAtLeast(0)
        val endLine = (range.end.line - 1).coerceAtLeast(0)
        if (startLine >= document.lineCount || endLine >= document.lineCount) return null

        val startOffset =
            (document.getLineStartOffset(startLine) + range.start.column)
                .coerceAtMost(document.getLineEndOffset(startLine))
        val endOffset =
            (document.getLineStartOffset(endLine) + range.end.column)
                .coerceAtMost(document.getLineEndOffset(endLine))

        if (startOffset > endOffset) return null
        return TextRange(startOffset, endOffset)
    }
}

/**
 * Applies exactly the text edits the Rust linter supplied — never computes
 * placement itself. Edits are applied from the end of the document backward
 * so earlier offsets stay valid.
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

        val offsets =
            edits.mapNotNull { edit ->
                val startLine = (edit.start.line - 1).coerceAtLeast(0)
                val endLine = (edit.end.line - 1).coerceAtLeast(0)
                if (startLine >= document.lineCount || endLine >= document.lineCount) {
                    null
                } else {
                    val start =
                        (document.getLineStartOffset(startLine) + edit.start.column)
                            .coerceAtMost(document.getLineEndOffset(startLine))
                    val end =
                        (document.getLineStartOffset(endLine) + edit.end.column)
                            .coerceAtMost(document.getLineEndOffset(endLine))
                    EditOffset(start, end, edit.text)
                }
            }

        for (offset in offsets.sortedByDescending { it.start }) {
            document.replaceString(offset.start, offset.end, offset.text)
        }
    }

    private data class EditOffset(
        val start: Int,
        val end: Int,
        val text: String,
    )
}
