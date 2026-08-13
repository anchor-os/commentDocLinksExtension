package com.anchor.commentdoclinks.parser

import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.TicketLink

/**
 * A reference found in a document, tagged with the 0-based line it lives on.
 */
data class ScannedReference(
    val reference: ParsedReference,
    val line: Int,
)

/**
 * Scan a whole document for references that live inside comments.
 *
 * This is the single shared entry point for every feature that needs the full
 * set of references in a document: link provider, hover, decorations and
 * diagnostics. Comment detection (including multiline block comments) is
 * handled here exactly once.
 *
 * [languageId] must be supplied by the caller (our [DocumentLike] only carries
 * line text); the IntelliJ service layer derives it from the PSI file.
 *
 * @param ticketLinks Configured external ticket links (see
 *   [com.anchor.commentdoclinks.config.CommentDocLinksConfig.ticketLinks]).
 * @return scanned references, in document order
 */
fun scanDocumentForReferences(
    document: DocumentLike,
    languageId: String,
    ticketLinks: List<TicketLink> = emptyList(),
): List<ScannedReference> {
    if (!supportsLanguage(languageId)) {
        return emptyList()
    }

    val results = mutableListOf<ScannedReference>()
    val state = CommentScannerState()

    for (line in 0 until document.lineCount) {
        val text = document.lineAt(line)

        for (range in getCommentRanges(languageId, text, state)) {
            val matches =
                parseComment(
                    text.substring(range.start, range.end),
                    range.start,
                    ticketLinks,
                )

            for (reference in matches) {
                results.add(ScannedReference(reference, line))
            }
        }
    }

    return results
}
