package com.anchor.commentdoclinks.parser

import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ReferenceType
import com.anchor.commentdoclinks.model.TicketLink

/**
 * Documentation reference detection (global).
 *
 * The path must not start with `/` (absolute paths rejected) and the
 * look-behind rejects references inside URLs, after word chars, `:`, `.`,
 * `/`, and `\` (so `C:\docs\file.md` and `\\server\share\docs\file.md` are
 * rejected). `#42` is deliberately NOT a line reference — it stays a heading
 * anchor so `#anchor` and `#L42` never conflict.
 */
private val DOCUMENTATION_REGEX =
    Regex(
        """(?<![\w:./\\])([A-Za-z0-9_.-][A-Za-z0-9_./-]*\.md)""" +
            """(?:(?::(\d+))|(?:#[Ll](\d+))|(?:#|\s+-\s+|\s+—\s+)([A-Za-z0-9_-]+))?""",
    )

/** Anchored variant used to normalize a single already-detected reference. */
private val DOCUMENTATION_ANCHORED =
    Regex(
        """^([A-Za-z0-9_.-][A-Za-z0-9_./-]*\.md)""" +
            """(?:(?::(\d+))|(?:#[Ll](\d+))|(?:#|\s+-\s+|\s+—\s+)([A-Za-z0-9_-]+))?$""",
    )

/** Issue reference: `#123` (leading word char forbidden). */
private val ISSUE_REGEX = Regex("""(?<![\w:#])#(\d+)\b""")

private val ISSUE_ANCHORED = Regex("""^#(\d+)$""")

/** API reference: `API:Foo`. */
private val API_REGEX = Regex("""(?<!\w)API:([A-Za-z0-9_-]+)\b""")

private val API_ANCHORED = Regex("""^API:([A-Za-z0-9_-]+)$""")

/**
 * A raw reference span with 0-based character offsets.
 *
 * @property url Resolved click URL for ticket references; `null` for all other
 *   reference kinds.
 * @property label Hover label for ticket references; `null` otherwise.
 */
data class ReferenceSpan(
    val raw: String,
    val start: Int,
    val end: Int,
    val url: String? = null,
    val label: String? = null,
)

/**
 * Compile a user-supplied ticket-key pattern into a detection regex.
 *
 * The pattern is wrapped with a leading `(?<!\w)` look-behind so keys embedded
 * in longer words or URLs are not matched. Invalid patterns are skipped
 * (logged) to guard against bad regex / ReDoS from user input.
 */
internal fun TicketLink.toRegex(): Regex? =
    try {
        Regex("""(?<!\w)($pattern)(?!\w)""")
    } catch (e: Exception) {
        println("commentDocLinks.ticketLinks: skipping invalid pattern \"$pattern\": ${e.message}")
        null
    }

/**
 * Detect reference spans in text, in priority order.
 *
 * Documentation references win over the generic issue/API forms, so a
 * reference inside an already-matched span (for example `file.md#123`) is
 * never reported twice with conflicting types. Ticket keys from
 * [ticketLinks] are detected last; a span already consumed by a
 * higher-priority reference is skipped and the first matching ticket entry
 * wins.
 *
 * @return spans sorted by start offset
 */
fun detectReferenceSpans(
    text: String,
    ticketLinks: List<TicketLink> = emptyList(),
): List<ReferenceSpan> {
    val accepted = mutableListOf<ReferenceSpan>()
    val consumed = mutableListOf<ReferenceSpan>()

    fun accept(
        match: MatchResult,
        url: String? = null,
        label: String? = null,
    ) {
        val span =
            ReferenceSpan(
                raw = match.value,
                start = match.range.first,
                end = match.range.last + 1,
                url = url,
                label = label,
            )
        for (existing in consumed) {
            if (span.start < existing.end && existing.start < span.end) return
        }
        consumed.add(span)
        accepted.add(span)
    }

    DOCUMENTATION_REGEX.findAll(text).forEach { match -> accept(match) }
    ISSUE_REGEX.findAll(text).forEach { match -> accept(match) }
    API_REGEX.findAll(text).forEach { match -> accept(match) }

    for (link in ticketLinks) {
        val regex = link.toRegex() ?: continue
        regex.findAll(text).forEach { match ->
            accept(match, link.baseUrl + match.value, link.label)
        }
    }

    return accepted.sortedBy { it.start }
}

/**
 * Normalize a raw reference string into a typed [ParsedReference].
 *
 * Handles documentation, issue and API references. Ticket references are
 * produced directly by [parseComment] from the spans detected by
 * [detectReferenceSpans] (which carry the resolved URL/label), so they never
 * rely on this function.
 */
fun parseReference(raw: String): ParsedReference? {
    DOCUMENTATION_ANCHORED.matchEntire(raw)?.let { m ->
        val g = m.groupValues
        val line =
            when {
                g[2].isNotEmpty() -> g[2].toIntOrNull()
                g[3].isNotEmpty() -> g[3].toIntOrNull()
                else -> null
            }
        return ParsedReference(
            type = ReferenceType.DOCUMENTATION,
            raw = raw,
            file = g[1],
            anchor = if (g[4].isNotEmpty()) g[4] else null,
            line = line,
            identifier = null,
        )
    }

    ISSUE_ANCHORED.matchEntire(raw)?.let { m ->
        return ParsedReference(
            type = ReferenceType.ISSUE,
            raw = raw,
            file = null,
            anchor = null,
            line = null,
            identifier = m.groupValues[1],
        )
    }

    API_ANCHORED.matchEntire(raw)?.let { m ->
        return ParsedReference(
            type = ReferenceType.API,
            raw = raw,
            file = null,
            anchor = null,
            line = null,
            identifier = m.groupValues[1],
        )
    }

    return null
}

/**
 * Parse every reference found in comment text.
 *
 * Ticket references are produced directly from the spans detected by
 * [detectReferenceSpans] (which carries the resolved URL/label).
 *
 * Offsets are relative to [offset], which should be the position of the
 * comment text inside its containing line.
 */
fun parseComment(
    text: String,
    offset: Int = 0,
    ticketLinks: List<TicketLink> = emptyList(),
): List<ParsedReference> =
    detectReferenceSpans(text, ticketLinks).mapNotNull { span ->
        val parsed =
            if (span.url != null) {
                ParsedReference(
                    type = ReferenceType.TICKET,
                    raw = span.raw,
                    file = null,
                    anchor = null,
                    line = null,
                    identifier = span.raw,
                    url = span.url,
                    label = span.label,
                )
            } else {
                parseReference(span.raw) ?: return@mapNotNull null
            }
        parsed.copy(start = offset + span.start, end = offset + span.end)
    }
