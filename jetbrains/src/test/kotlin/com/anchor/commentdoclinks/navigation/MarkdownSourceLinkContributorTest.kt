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
        val result =
            resolveSourceReference(
                document = stringDocument(sourceText),
                languageId = "javascript",
                documentationFile = "doc.md",
                anchor = "checkout-flow",
            )
        assertEquals(1, result.line)
        assertEquals(true, result.anchorFound)
    }

    @Test
    fun testResolveSourceReferenceFallbackWhenAnchorAbsent() {
        val sourceText = "// doc.md\n"
        val result =
            resolveSourceReference(
                document = stringDocument(sourceText),
                languageId = "javascript",
                documentationFile = "doc.md",
                anchor = "checkout-flow",
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

    @Test
    fun testHeadingInsideFenceIsRejected() {
        val md =
            """
            # Real heading
            ```
            # src/inside.js — anchor
            ```
            # Another real heading
            """.trimIndent()
        val contributor = MarkdownSourceLinkContributor()
        // Line 0: real heading -> not in fence.
        assertEquals(false, contributor.isInsideFence(md, 0))
        // Line 2 (the `# src/inside.js` line) is inside the fence.
        assertEquals(true, contributor.isInsideFence(md, 2))
        // Line 4: after the closing fence -> not in fence.
        assertEquals(false, contributor.isInsideFence(md, 4))
    }

    @Test
    fun testFenceWithInfoTextDoesNotClosePrematurely() {
        val md =
            """
            ```
            ```js
            # src/inside.js — anchor
            ```
            """.trimIndent()
        val contributor = MarkdownSourceLinkContributor()
        // The ```` ```js ```` line is content inside the block, not a close.
        assertEquals(true, contributor.isInsideFence(md, 2))
    }

    @Test
    fun testIndentedTripleBacktickIsNotAClosingFence() {
        val md =
            """
            ```
            # src/inside.js — anchor
                ```
            """.trimIndent()
        val contributor = MarkdownSourceLinkContributor()
        // A four-space-indented ``` is content, so line 2 stays inside the block.
        assertEquals(true, contributor.isInsideFence(md, 2))
    }
}
