package com.anchor.commentdoclinks.model

import kotlinx.serialization.Serializable

/**
 * A configured external ticket link, mirroring the
 * `commentDocLinks.ticketLinks` VS Code setting.
 *
 * @property baseUrl URL prefix; the matched key is appended to form the target.
 * @property pattern Regex for the ticket key (e.g. `ENC-\d+`). Compiled with a
 *   leading `(?<!\w)` look-behind so keys inside words/URLs are ignored.
 * @property label Optional hover label.
 */
@Serializable
data class TicketLink(
    val baseUrl: String,
    val pattern: String,
    val label: String?,
)
