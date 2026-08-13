package com.anchor.commentdoclinks.model

/**
 * Result of resolving/validating a [ParsedReference].
 *
 * Pure data carrier consumed by navigation, hover, diagnostics and decorations.
 */
data class ResolutionResult(
    val status: ResolutionStatus,
    val targetPath: String? = null,
    val line: Int? = null,
    val message: String? = null,
)
