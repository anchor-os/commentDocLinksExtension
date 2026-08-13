package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.model.stringDocument
import com.anchor.commentdoclinks.resolver.parseMarkdownHeading
import com.anchor.commentdoclinks.resolver.resolveInRoot
import com.anchor.commentdoclinks.resolver.resolveSourceReference
import com.anchor.commentdoclinks.resolver.workspaceRelativePath
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Reverse navigation logic for `## src/file.js — anchor` Markdown headings:
 * the heading parse yields a range covering the source span, and resolving the
 * source reference lands on the comment line that references the document.
 */
class MarkdownSourceLinkContributorTest {

    @Test
    fun testHeadingParseCoversSourceSpanOnly() {
        val line = "## src/app.js — checkout-flow"
        val heading = parseMarkdownHeading(line)!!
        assertEquals("src/app.js", heading.source)
        assertEquals("checkout-flow", heading.anchor)
        assertEquals(line.indexOf("src/app.js"), heading.start)
        assertEquals(line.indexOf("src/app.js") + "src/app.js".length, heading.end)
    }

    @Test
    fun testHeadingParseIgnoresNonHeading() {
        assertNull(parseMarkdownHeading("just a paragraph"))
        assertNull(parseMarkdownHeading("# h1 not a source heading"))
    }

    @Test
    fun testResolveSourceReferenceLandsOnCommentLine() {
        val sourceText = "// unrelated comment\n// doc.md#checkout-flow\n"
        val result = resolveSourceReference(
            document = stringDocument(sourceText),
            languageId = "javascript",
            documentationFile = "doc.md",
            anchor = "checkout-flow"
        )
        assertEquals(1, result.line)
        assertEquals(true, result.anchorFound)
    }

    @Test
    fun testResolveSourceReferenceFallbackWhenAnchorAbsent() {
        val sourceText = "// doc.md\n"
        val result = resolveSourceReference(
            document = stringDocument(sourceText),
            languageId = "javascript",
            documentationFile = "doc.md",
            anchor = "checkout-flow"
        )
        // file referenced without the anchor -> first reference line, anchorFound false
        assertEquals(0, result.line)
        assertEquals(false, result.anchorFound)
    }

    @Test
    fun testPathResolutionIntegration() {
        assertEquals("/repo/src/app.js", resolveInRoot("/repo", "src/app.js"))
        assertEquals("doc.md", workspaceRelativePath("/repo/doc.md", "/repo"))
        assertNull(resolveInRoot("/repo", "../escape.md"))
    }
}
