package com.anchor.commentdoclinks.parser

import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ReferenceType

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

/** Documentation ticket reference: `DOC-123`. */
private val TICKET_REGEX = Regex("""(?<!\w)DOC-(\d+)\b""")

private val TICKET_ANCHORED = Regex("""^DOC-(\d+)$""")

/** API reference: `API:Foo`. */
private val API_REGEX = Regex("""(?<!\w)API:([A-Za-z0-9_-]+)\b""")

private val API_ANCHORED = Regex("""^API:([A-Za-z0-9_-]+)$""")

/**
 * A raw reference span with 0-based character offsets.
 */
data class ReferenceSpan(
    val raw: String,
    val start: Int,
    val end: Int,
)

/**
 * Detect reference spans in text, in priority order.
 *
 * Documentation references win over the generic issue/ticket/API forms, so a
 * reference inside an already-matched span (for example `file.md#123`) is
 * never reported twice with conflicting types. Overlapping spans are dropped.
 *
 * @return spans sorted by start offset
 */
fun detectReferenceSpans(text: String): List<ReferenceSpan> {
    val accepted = mutableListOf<ReferenceSpan>()
    val consumed = mutableListOf<ReferenceSpan>()

    fun accept(match: MatchResult) {
        val span =
            ReferenceSpan(
                raw = match.value,
                start = match.range.first,
                end = match.range.last + 1,
            )
        for (existing in consumed) {
            if (span.start < existing.end && existing.start < span.end) return
        }
        consumed.add(span)
        accepted.add(span)
    }

    DOCUMENTATION_REGEX.findAll(text).forEach(::accept)
    ISSUE_REGEX.findAll(text).forEach(::accept)
    TICKET_REGEX.findAll(text).forEach(::accept)
    API_REGEX.findAll(text).forEach(::accept)

    return accepted.sortedBy { it.start }
}

/**
 * Normalize a raw reference string into a typed [ParsedReference].
 *
 * A documentation reference carries a `file` plus optional `anchor`/`line`.
 * Issue/API/DOC-… references carry an `identifier`.
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

    TICKET_ANCHORED.matchEntire(raw)?.let {
        return ParsedReference(
            type = ReferenceType.DOCUMENTATION,
            raw = raw,
            file = null,
            anchor = null,
            line = null,
            identifier = raw,
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
 * Offsets are relative to [offset], which should be the position of the
 * comment text inside its containing line.
 */
fun parseComment(
    text: String,
    offset: Int = 0,
): List<ParsedReference> =
    detectReferenceSpans(text).mapNotNull { span ->
        parseReference(span.raw)?.copy(start = offset + span.start, end = offset + span.end)
    }
