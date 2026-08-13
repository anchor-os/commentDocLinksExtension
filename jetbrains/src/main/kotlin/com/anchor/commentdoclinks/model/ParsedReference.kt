package com.anchor.commentdoclinks.model

/**
 * A parsed reference with its character span.
 *
 * Mirrors the [ParsedReference] typedef in [src/references/referenceParser.js].
 * `start`/`end` are 0-based character offsets into the containing text
 * (relative to the line/comment offset passed to [parseComment]).
 */
data class ParsedReference(
    val type: ReferenceType,
    val raw: String,
    val file: String?,
    val anchor: String?,
    val line: Int?,
    val identifier: String?,
    val url: String? = null,
    val label: String? = null,
    val start: Int = 0,
    val end: Int = 0,
) {
    val isExternal: Boolean
        get() = type != ReferenceType.DOCUMENTATION || file == null
}
