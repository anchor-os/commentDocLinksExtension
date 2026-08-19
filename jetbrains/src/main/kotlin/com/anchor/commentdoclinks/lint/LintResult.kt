package com.anchor.commentdoclinks.lint

import kotlinx.serialization.Serializable

/**
 * Machine-readable contract mirrored from the `custom-biome-lint` v1 protocol
 * (docs/IDE_PROTOCOL.md). `custom-biome-lint --stdin <path> --format json`
 * (or `custom-biome-lint <path> --format json`) prints this to stdout even on
 * a non-zero exit caused by violations; stderr is logs only.
 *
 * Coordinates: lines are 1-based; columns are 1-based UTF-8 *byte* offsets
 * (NOT characters, NOT UTF-16). A multibyte char (é, 你, 😀) advances the byte
 * column by its UTF-8 byte length. Spans are half-open [startColumn, endColumn);
 * `endLine`/`endColumn` are OMITTED for line-only rules.
 *
 * The IntelliJ adapter converts the contract's byte columns into Document
 * character offsets via [ByteOffsetConverter]; it never computes placement
 * itself. The Rust binary is the single source of truth.
 */
@Serializable
data class LintResult(
    val version: Int = 1,
    val files: List<LintFile> = emptyList(),
    val summary: LintSummary? = null,
)

@Serializable
data class LintFile(
    val path: String = "",
    val violations: List<LintViolation> = emptyList(),
)

@Serializable
data class LintViolation(
    val rule: String,
    val message: String,
    val severity: String = "error", // "error" | "warning"
    // 1-based point coordinate (always present).
    val line: Int? = null,
    val col: Int? = null,
    // 1-based byte-offset span (line-only rules omit endLine/endColumn).
    val startLine: Int? = null,
    val startColumn: Int? = null,
    val endLine: Int? = null,
    val endColumn: Int? = null,
    val fixes: List<LintAction> = emptyList(),
    val suppressions: List<LintAction> = emptyList(),
)

@Serializable
data class LintAction(
    val kind: String? = null, // "safe" | "unsafe" (fixes) / "suppress" (suppressions)
    val title: String? = null,
    val edits: List<LintEdit> = emptyList(),
)

@Serializable
data class LintEdit(
    val startLine: Int,
    val startColumn: Int,
    val endLine: Int,
    val endColumn: Int,
    val replacement: String = "",
)

@Serializable
data class LintSummary(
    val errors: Int = 0,
    val warnings: Int = 0,
    val filesWithViolations: Int = 0,
    val filesChecked: Int = 0,
    val filesCacheSkipped: Int = 0,
    val elapsedMs: Int = 0,
    val clean: Boolean = false,
)
