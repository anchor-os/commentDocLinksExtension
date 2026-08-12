package com.anchor.commentdoclinks.config

import com.intellij.ide.util.PropertiesComponent

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

    var enableDecorations: Boolean
        get() = PropertiesComponent.getInstance().getBoolean(PREFIX + "enableDecorations", true)
        set(value) = PropertiesComponent.getInstance().setValue(PREFIX + "enableDecorations", value.toString())

    var enableDiagnostics: Boolean
        get() = PropertiesComponent.getInstance().getBoolean(PREFIX + "enableDiagnostics", true)
        set(value) = PropertiesComponent.getInstance().setValue(PREFIX + "enableDiagnostics", value.toString())

    var enableCompletion: Boolean
        get() = PropertiesComponent.getInstance().getBoolean(PREFIX + "enableCompletion", true)
        set(value) = PropertiesComponent.getInstance().setValue(PREFIX + "enableCompletion", value.toString())
}
