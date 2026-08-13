package com.anchor.commentdoclinks.completion

import com.anchor.commentdoclinks.FakeFileSystem
import com.anchor.commentdoclinks.model.stringDocument
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Completion suggestion logic for documentation anchors (`file.md#`) and
 * Markdown source-heading anchors (`## src/file.js — `). Tests the pure
 * [suggestDocAnchorCompletions] / [suggestSourceAnchorCompletions] functions
 * directly (the contributor is a thin caller).
 */
class ReferenceCompletionContributorTest {

    @Test
    fun testSuggestsDocAnchorsAfterHash() {
        val docText = "# Title\n## checkout-flow\n## overview\n"
        val fs = FakeFileSystem(mapOf("/repo/doc.md" to docText))

        val variants = suggestDocAnchorCompletions("/* doc.md#", "/repo", fs)
        assertTrue("expected checkout-flow", "checkout-flow" in variants)
        assertTrue("expected overview", "overview" in variants)
    }

    @Test
    fun testNoSuggestionsWithoutHash() {
        val fs = FakeFileSystem(mapOf("/repo/doc.md" to "# Title\n## checkout-flow\n"))
        assertEquals(emptyList<String>(), suggestDocAnchorCompletions("/* doc.md", "/repo", fs))
    }

    @Test
    fun testSuggestsSourceAnchorsForHeading() {
        val sourceText = "// doc.md#checkout-flow\n// doc.md#overview\n"
        val fs = FakeFileSystem(mapOf("/repo/src/app.js" to sourceText))

        val variants = suggestSourceAnchorCompletions(
            headingPrefix = "## src/app.js — ",
            markdownPath = "/repo/doc.md",
            root = "/repo",
            fs = fs
        )
        assertTrue("expected checkout-flow", "checkout-flow" in variants)
        assertTrue("expected overview", "overview" in variants)
    }

    @Test
    fun testNoHeadingSuggestionsWithoutDash() {
        val fs = FakeFileSystem(mapOf("/repo/src/app.js" to "// doc.md#checkout-flow\n"))
        assertEquals(
            emptyList<String>(),
            suggestSourceAnchorCompletions("## src/app.js", "/repo/doc.md", "/repo", fs)
        )
    }
}
