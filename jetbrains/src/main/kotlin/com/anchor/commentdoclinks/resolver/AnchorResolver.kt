package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.DocumentLike

/**
 * A located anchor within a Markdown document.
 */
data class AnchorLocation(
    val anchor: String,
    val line: Int,
    val character: Int,
)

/**
 * A resolved anchor position (0-based line/character).
 */
data class Location(
    val line: Int,
    val character: Int,
)

private val HTML_ANCHOR_REGEX = Regex("""<a id="([A-Za-z0-9_-]+)"></a>""")
private val PLAIN_HEADING_REGEX = Regex("""^#{1,6}\s+(.+)$""")

/**
 * GitHub-style slug for a plain Markdown heading.
 *
 * `## Checkout Flow!` → `checkout-flow`
 * `## API & Errors`  → `api-errors`
 */
fun markdownSlug(headingText: String): String =
    headingText
        .trim()
        .lowercase()
        .replace(Regex("""[^\p{L}\p{N}_ -]"""), "")
        .replace(" ", "-")

/**
 * All `## src/file.js — anchor` headings, in document order.
 */
private fun explicitAnchors(document: DocumentLike): List<AnchorLocation> {
    val result = mutableListOf<AnchorLocation>()
    for (i in 0 until document.lineCount) {
        val parsed = parseMarkdownHeading(document.lineAt(i)) ?: continue
        result.add(AnchorLocation(parsed.anchor, i, 0))
    }
    return result
}

/**
 * All `<a id="anchor"></a>` HTML anchors, in document order.
 */
private fun htmlAnchors(document: DocumentLike): List<AnchorLocation> {
    val result = mutableListOf<AnchorLocation>()
    for (i in 0 until document.lineCount) {
        val match = HTML_ANCHOR_REGEX.find(document.lineAt(i)) ?: continue
        result.add(AnchorLocation(match.groupValues[1], i, 0))
    }
    return result
}

/**
 * Plain Markdown headings (no explicit `— anchor` suffix), slugified.
 * Repeated slugs get numeric suffixes (`foo`, `foo-1`, `foo-2`, …) while a
 * heading literally named `Foo-1` keeps its own slug so generated suffixes
 * never collide with it.
 */
private fun slugAnchors(document: DocumentLike): List<AnchorLocation> {
    val result = mutableListOf<AnchorLocation>()
    val seen = mutableSetOf<String>()

    for (i in 0 until document.lineCount) {
        val text = document.lineAt(i)
        if (parseMarkdownHeading(text) != null) continue

        val heading = PLAIN_HEADING_REGEX.matchEntire(text) ?: continue
        val slug = markdownSlug(heading.groupValues[1])
        if (slug.isEmpty()) continue

        var candidate = slug
        var n = 1
        while (seen.contains(candidate)) {
            candidate = "$slug-$n"
            n++
        }
        seen.add(candidate)
        result.add(AnchorLocation(candidate, i, 0))
    }
    return result
}

/**
 * Locate an anchor inside a Markdown document, in resolution order:
 * explicit headings → HTML anchors → slugified plain headings.
 * Exact (non-prefix) match. Empty anchor → null.
 */
fun resolveAnchor(
    document: DocumentLike,
    anchor: String,
): Location? {
    if (anchor.isEmpty()) return null

    for (entry in explicitAnchors(document)) {
        if (entry.anchor == anchor) return Location(entry.line, entry.character)
    }
    for (entry in htmlAnchors(document)) {
        if (entry.anchor == anchor) return Location(entry.line, entry.character)
    }
    for (entry in slugAnchors(document)) {
        if (entry.anchor == anchor) return Location(entry.line, entry.character)
    }
    return null
}

/**
 * List every anchor defined in a Markdown document, in document order,
 * deduplicated (first occurrence wins). Used by completion and diagnostics.
 */
fun listAnchors(document: DocumentLike): List<String> {
    val entries = explicitAnchors(document) + htmlAnchors(document) + slugAnchors(document)
    val sorted = entries.sortedWith(compareBy({ it.line }, { it.character }))
    val anchors = mutableListOf<String>()
    for (entry in sorted) {
        if (!anchors.contains(entry.anchor)) anchors.add(entry.anchor)
    }
    return anchors
}
