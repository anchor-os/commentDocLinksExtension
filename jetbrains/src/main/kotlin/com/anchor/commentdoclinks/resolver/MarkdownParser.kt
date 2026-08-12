package com.anchor.commentdoclinks.resolver

/**
 * Canonical separator between a source file and its anchor in Markdown
 * headings: `## src/checkout/cart.js — checkout-flow`.
 */
const val MARKDOWN_SOURCE_SEPARATOR = "—"

/**
 * Alternate heading separator tolerated for existing documents
 * (`## src/checkout/cart.js - anchor`).
 */
const val ALTERNATE_SOURCE_SEPARATOR = "-"

/**
 * Anchor separator (`#`) also accepted in headings
 * (`## src/checkout/cart.js#checkout-flow`).
 */
const val ANCHOR_SEPARATOR = "#"

/**
 * A parsed documentation heading.
 *
 * @property source clickable source path (group 1 of the regex)
 * @property anchor the anchor identifier (group 2)
 * @property start  0-based char offset of the source path start on the line
 * @property end    0-based char offset just past the source path
 */
data class ParsedHeading(
    val source: String,
    val anchor: String,
    val start: Int,
    val end: Int
)

private val MARKDOWN_HEADING_REGEX = Regex(
    """^#{2,}\s+(.+?)(?:\s+""" + MARKDOWN_SOURCE_SEPARATOR + """\s+|""" +
        """\s+""" + ALTERNATE_SOURCE_SEPARATOR + """\s+|""" +
        ANCHOR_SEPARATOR + """)""" +
        """([A-Za-z0-9_-]+)$"""
)

/**
 * Parse a documentation heading:
 *
 *   ## src/checkout/cart.js — checkout-flow
 *   ## src/checkout/cart.js - checkout-flow
 *   ## src/checkout/cart.js#checkout-flow
 *
 * Returns null when the line is not a documentation heading. The returned
 * `start`/`end` span covers the source path only (not the separator/anchor).
 */
fun parseMarkdownHeading(line: String): ParsedHeading? {
    val match = MARKDOWN_HEADING_REGEX.matchEntire(line) ?: return null
    val source = match.groupValues[1]
    return ParsedHeading(
        source = source,
        anchor = match.groupValues[2],
        start = line.indexOf(source),
        end = line.indexOf(source) + source.length
    )
}
