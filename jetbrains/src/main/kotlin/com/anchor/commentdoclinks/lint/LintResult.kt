package com.anchor.commentdoclinks.lint

import kotlinx.serialization.Serializable

/**
 * Machine-readable contract mirrored from the VS Code extension
 * (docs/custom-biome-lint-integration.md). `custom-biome-lint <file>
 * --format json` prints this to stdout; stderr is logs only. A non-zero
 * exit due to violations is not a crash — the JSON is still present.
 *
 * Lines are 1-based, columns are 0-based UTF-16 (LSP/ESLint style).
 */
@Serializable
data class LintPosition(
    val line: Int,
    val column: Int,
)

@Serializable
data class LintRange(
    val start: LintPosition,
    val end: LintPosition,
)

@Serializable
data class LintEdit(
    val start: LintPosition,
    val end: LintPosition,
    val text: String,
)

@Serializable
data class LintFix(
    val kind: String = "safe",
    val title: String = "Apply fix",
    val edits: List<LintEdit> = emptyList(),
)

@Serializable
data class LintSuppression(
    val title: String = "Suppress rule",
    val edits: List<LintEdit> = emptyList(),
)

@Serializable
data class LintDiagnostic(
    val rule: String,
    val message: String,
    val severity: String = "error",
    val range: LintRange,
    val fix: LintFix? = null,
    val suppression: LintSuppression? = null,
    val docsUrl: String? = null,
)

@Serializable
data class LintResult(
    val diagnostics: List<LintDiagnostic> = emptyList(),
)
