package com.anchor.commentdoclinks.config

import com.anchor.commentdoclinks.model.TicketLink
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.options.ConfigurationException
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.dsl.builder.Align
import com.intellij.ui.dsl.builder.panel
import com.intellij.util.ui.JBUI
import kotlinx.serialization.json.Json
import javax.swing.JComponent

/**
 * Settings page for Comment Doc Links, mirroring the VS Code
 * `commentDocLinks.*` settings. Ticket links are edited as JSON
 * (`[{ "baseUrl": "...", "pattern": "...", "label": "..." }]`), which is the
 * exact format stored by [CommentDocLinksConfig.ticketLinks].
 */
class CommentDocLinksConfigurable : Configurable {
    private val prettyJson =
        Json {
            prettyPrint = true
            ignoreUnknownKeys = true
        }

    private val decorationsBox = JBCheckBox("Highlight references in the editor")
    private val diagnosticsBox = JBCheckBox("Report broken references as warnings")
    private val completionBox = JBCheckBox("Suggest anchors while typing")
    private val ticketLinksArea =
        JBTextArea(
            """
            [
              {
                "baseUrl": "https://issues.example.com/browse/",
                "pattern": "ENC-\\d+",
                "label": "Jira"
              }
            ]
            """.trimIndent(),
            8,
            60,
        ).apply { lineWrap = true }

    private var component: JComponent? = null

    override fun getDisplayName(): String = "Comment Doc Links"

    override fun createComponent(): JComponent {
        if (component == null) {
            component =
                panel {
                    group("General") {
                        row { cell(decorationsBox) }
                        row { cell(diagnosticsBox) }
                        row { cell(completionBox) }
                    }
                    group("Ticket links") {
                        row(JBLabel("External ticket references (JSON):")) { }
                        row {
                            cell(ticketLinksArea)
                                .align(Align.FILL)
                                .comment(
                                    "Each entry: { \"baseUrl\": \"...\", \"pattern\": \"regex for the key\", " +
                                        "\"label\": \"optional\" }. The matched key is appended to baseUrl and opened in the browser.",
                                )
                        }
                    }
                }.apply { border = JBUI.Borders.empty(10) }
        }
        return component!!
    }

    override fun isModified(): Boolean =
        decorationsBox.isSelected != CommentDocLinksConfig.enableDecorations ||
            diagnosticsBox.isSelected != CommentDocLinksConfig.enableDiagnostics ||
            completionBox.isSelected != CommentDocLinksConfig.enableCompletion ||
            prettyJson.encodeToString(CommentDocLinksConfig.ticketLinks) != currentTicketLinksJson()

    override fun apply() {
        val parsed =
            try {
                prettyJson.decodeFromString<List<TicketLink>>(ticketLinksArea.text)
            } catch (e: Exception) {
                throw ConfigurationException("Invalid ticket links JSON: ${e.message}")
            }

        CommentDocLinksConfig.enableDecorations = decorationsBox.isSelected
        CommentDocLinksConfig.enableDiagnostics = diagnosticsBox.isSelected
        CommentDocLinksConfig.enableCompletion = completionBox.isSelected
        CommentDocLinksConfig.ticketLinks = parsed
    }

    override fun reset() {
        decorationsBox.isSelected = CommentDocLinksConfig.enableDecorations
        diagnosticsBox.isSelected = CommentDocLinksConfig.enableDiagnostics
        completionBox.isSelected = CommentDocLinksConfig.enableCompletion
        ticketLinksArea.text = prettyJson.encodeToString(CommentDocLinksConfig.ticketLinks)
    }

    override fun disposeUIResources() {
        component = null
    }

    private fun currentTicketLinksJson(): String = prettyJson.encodeToString(CommentDocLinksConfig.ticketLinks)
}
