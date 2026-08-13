package com.anchor.commentdoclinks.config

import com.anchor.commentdoclinks.model.TicketLink
import com.intellij.ide.util.PropertiesComponent
import kotlinx.serialization.json.Json

/**
 * Plugin configuration, mirroring the VS Code `commentDocLinks.*` settings.
 *
 * Values are stored in IntelliJ's application-level [PropertiesComponent]
 * under the `commentDocLinks.` prefix. Defaults match the VS Code extension
 * (everything enabled).
 *
 * Display-only keys from VS Code (`linkColor`, `linkUnderline`) are accepted
 * but not yet wired into the highlighter; the link color is currently derived
 * from `DOC_COMMENT_TAG_VALUE` via [com.anchor.commentdoclinks.decorations.LINK_KEY].
 */
object CommentDocLinksConfig {
    private const val PREFIX = "commentDocLinks."

    private val ticketLinksJson =
        Json {
            ignoreUnknownKeys = true
            isLenient = true
        }

    var enableDecorations: Boolean
        get() = PropertiesComponent.getInstance().getBoolean(PREFIX + "enableDecorations", true)
        set(value) = PropertiesComponent.getInstance().setValue(PREFIX + "enableDecorations", value.toString())

    var enableDiagnostics: Boolean
        get() = PropertiesComponent.getInstance().getBoolean(PREFIX + "enableDiagnostics", true)
        set(value) = PropertiesComponent.getInstance().setValue(PREFIX + "enableDiagnostics", value.toString())

    var enableCompletion: Boolean
        get() = PropertiesComponent.getInstance().getBoolean(PREFIX + "enableCompletion", true)
        set(value) = PropertiesComponent.getInstance().setValue(PREFIX + "enableCompletion", value.toString())

    /**
     * Configured external ticket links. Empty by default. Stored as a JSON
     * array under `commentDocLinks.ticketLinks`; malformed values are ignored
     * and treated as empty.
     */
    var ticketLinks: List<TicketLink>
        get() {
            val raw = PropertiesComponent.getInstance().getValue(PREFIX + "ticketLinks") ?: return emptyList()
            return runCatching { ticketLinksJson.decodeFromString<List<TicketLink>>(raw) }
                .getOrElse { emptyList() }
        }
        set(value) =
            PropertiesComponent.getInstance().setValue(
                PREFIX + "ticketLinks",
                ticketLinksJson.encodeToString(value),
            )
}
