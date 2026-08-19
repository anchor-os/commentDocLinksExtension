package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.config.CommentDocLinksConfig
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ReferenceType
import com.anchor.commentdoclinks.resolver.ParsedHeading
import com.anchor.commentdoclinks.parser.detectReferenceSpans
import com.anchor.commentdoclinks.resolver.ALTERNATE_SOURCE_SEPARATOR
import com.anchor.commentdoclinks.resolver.ANCHOR_SEPARATOR
import com.anchor.commentdoclinks.resolver.MARKDOWN_SOURCE_SEPARATOR
import com.intellij.lang.Language
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.TextRange
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceContributor
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.PsiReferenceRegistrar
import com.intellij.util.ProcessingContext

/**
 * Provides navigable links for Markdown documentation headings.
 *
 * Registered per-[PsiElement] on the Markdown language (NOT per-file): IntelliJ
 * only invokes element-level reference providers during highlighting. Each
 * heading fires as a dedicated `MarkdownHeader` PSI element (element types
 * `ATX_1`..`ATX_6` / `SETEXT_1`..`SETEXT_2`), so the provider is invoked once
 * per heading and ancestor blocks do not also produce references.
 *
 * A heading line may carry both kinds of link:
 *  - a source reference, e.g. `## src/checkout/cart.js — checkout-flow` or
 *    `## src/util/qrcode.js#local-qr-auto-size`, which navigates to the source
 *    file (reverse of the VS Code `src/providers/markdownLinkProvider.js`);
 *  - external ticket references from `commentDocLinks.ticketLinks`, e.g.
 *    `## src/util/qrcode.js#local-qr-auto-size ENC-78788` resolves both the
 *    source link and the `ENC-78788` Jira link separately.
 */
class MarkdownSourceLinkContributor : PsiReferenceContributor() {
    override fun registerReferenceProviders(registrar: PsiReferenceRegistrar) {
        val markdown = Language.findLanguageByID(MARKDOWN_LANGUAGE_ID)
        if (markdown == null) {
            LOG.debug("CDL MD CONTRIB markdown language not found; skip registration")
            return
        }
        registrar.registerReferenceProvider(
            PlatformPatterns.psiElement().withLanguage(markdown),
            provider,
        )
        LOG.debug("CDL MD CONTRIB registered provider on markdown language")
    }

    private val provider =
        object : PsiReferenceProvider() {
            override fun getReferencesByElement(
                element: PsiElement,
                context: ProcessingContext,
            ): Array<PsiReference> {
                return referencesForElement(element)
            }
        }

    /**
     * File-level entry point used by tests (and any callers that hold a
     * [PsiFile] rather than an individual heading element). Scans every line of
     * the document for heading lines and produces source + ticket references,
     * mirroring [referencesForElement] but with file-relative ranges.
     */
    internal fun referencesForFile(element: PsiElement): Array<PsiReference> {
        val file = element as? PsiFile ?: return PsiReference.EMPTY_ARRAY
        val virtualFile = file.virtualFile ?: return PsiReference.EMPTY_ARRAY
        val languageId = languageIdFromVirtualFile(virtualFile) ?: return PsiReference.EMPTY_ARRAY
        if (languageId != "markdown") return PsiReference.EMPTY_ARRAY
        val document = file.viewProvider.document ?: return PsiReference.EMPTY_ARRAY

        val references = mutableListOf<PsiReference>()
        var inFence = false
        for (line in 0 until document.lineCount) {
            val lineStart = document.getLineStartOffset(line)
            val lineEnd = document.getLineEndOffset(line)
            val lineText = document.getText(TextRange(lineStart, lineEnd))
            val trimmed = lineText.trim()
            // Toggle fenced-code state so lines inside ``` blocks are never
            // mistaken for headings.
            if (trimmed.startsWith("```")) {
                inFence = !inFence
                continue
            }
            if (inFence) continue
            val isHeadingLine =
                HEADING_LINE_PREFIX.matches(lineText) ||
                    (line + 1 < document.lineCount &&
                        isSetextUnderline(
                            document
                                .getText(
                                    TextRange(
                                        document.getLineStartOffset(line + 1),
                                        document.getLineEndOffset(line + 1),
                                    ),
                                ).trim(),
                        ))
            if (!isHeadingLine) continue

            for (src in findMarkdownSourceReferences(lineText)) {
                val heading = ParsedHeading(src.source, src.anchor, src.start, src.end)
                references.add(
                    MarkdownSourceReference(
                        file,
                        heading,
                        file,
                        TextRange(lineStart + src.start, lineStart + src.end),
                    ),
                )
            }
            for (span in detectReferenceSpans(lineText, CommentDocLinksConfig.ticketLinks)) {
                if (span.url == null) continue
                references.add(
                    CommentDocReference(
                        file,
                        ParsedReference(
                            type = ReferenceType.TICKET,
                            raw = span.raw,
                            file = null,
                            anchor = null,
                            line = null,
                            identifier = span.raw,
                            url = span.url,
                            label = span.label,
                            start = span.start,
                            end = span.end,
                        ),
                        file,
                        lineStart,
                    ),
                )
            }
        }
        return references.toTypedArray()
    }

    private fun referencesForElement(element: PsiElement): Array<PsiReference> {
        val file = element.containingFile ?: return EMPTY
        val lineText = headingLineText(element.text) ?: return EMPTY
        LOG.debug("CDL MD PROVIDER heading lineText=${lineText.take(80)}")

        val references = mutableListOf<PsiReference>()

        for (src in findMarkdownSourceReferences(lineText)) {
            val heading = ParsedHeading(src.source, src.anchor, src.start, src.end)
            LOG.debug(
                "CDL MD PROVIDER source ref range=${TextRange(src.start, src.end)} " +
                    "source=${src.source} anchor=${src.anchor}",
            )
            references.add(MarkdownSourceReference(element, heading, file, TextRange(src.start, src.end)))
        }

        for (span in detectReferenceSpans(lineText, CommentDocLinksConfig.ticketLinks)) {
            if (span.url == null) continue
            LOG.debug(
                "CDL MD PROVIDER ticket ref range=${TextRange(span.start, span.end)} " +
                    "url=${span.url} label=${span.label}",
            )
            references.add(
                CommentDocReference(
                    element,
                    ParsedReference(
                        type = ReferenceType.TICKET,
                        raw = span.raw,
                        file = null,
                        anchor = null,
                        line = null,
                        identifier = span.raw,
                        url = span.url,
                        label = span.label,
                        start = span.start,
                        end = span.end,
                    ),
                    file,
                    0,
                ),
            )
        }

        return references.toTypedArray()
    }

    /**
     * Determine the scannable heading line for an element's text, or `null` if
     * the element is not a heading. Handles both ATX headings (`#`/`##`…, single
     * line) and Setext headings (a text line followed by an `=`/`=` or `-`
     * underline). The returned line is the one that may carry source/ticket
     * references.
     */
    private fun headingLineText(rawText: String): String? {
        val text = rawText.trimEnd('\n', '\r')
        if (!text.contains('\n') && !text.contains('\r')) {
            if (!HEADING_LINE_PREFIX.matches(text)) return null
            return text
        }
        val lines = text.lines()
        if (lines.size == 2 && isSetextUnderline(lines[1].trim())) return lines[0]
        return null
    }

    private fun isSetextUnderline(line: String): Boolean = line.isNotBlank() && line.all { it == '=' || it == '-' }

    /**
     * Find source references (`src/file.js#anchor`, `src/file.js — anchor`,
     * `src/file.js - anchor`) anywhere in a heading line. `.md` targets are
     * excluded — those are forward documentation links, not reverse source
     * links, and are handled elsewhere.
     */
    private fun findMarkdownSourceReferences(line: String): List<SourceMatch> {
        val result = mutableListOf<SourceMatch>()
        for (match in MD_SOURCE_REGEX.findAll(line)) {
            val source = match.groupValues[1]
            if (source.endsWith(".md", ignoreCase = true)) continue
            val anchor = match.groupValues[2]
            result.add(SourceMatch(source, anchor, match.range.first, match.range.last + 1))
        }
        return result
    }

    private data class SourceMatch(
        val source: String,
        val anchor: String,
        val start: Int,
        val end: Int,
    )

    private val HEADING_LINE_PREFIX = Regex("""^#{1,6}\s.*""")

    companion object {
        private const val MARKDOWN_LANGUAGE_ID = "Markdown"
        private val MD_SOURCE_REGEX =
            Regex(
                """(?<!\w)([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)""" +
                    """(?:\s*""" + MARKDOWN_SOURCE_SEPARATOR + """\s*|\s*""" +
                    ALTERNATE_SOURCE_SEPARATOR + """\s*|""" + ANCHOR_SEPARATOR + """)""" +
                    """([A-Za-z0-9_-]+)""",
            )
        private val LOG = Logger.getInstance(MarkdownSourceLinkContributor::class.java)
        private val EMPTY = PsiReference.EMPTY_ARRAY
    }
}
