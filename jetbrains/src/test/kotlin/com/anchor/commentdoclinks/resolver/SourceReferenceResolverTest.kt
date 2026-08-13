package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.stringDocument
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SourceReferenceResolverTest {
    private val languageId = "javascript"

    @Test
    fun `exact anchor reference wins`() {
        val doc =
            stringDocument(
                """
                // docs/guide.md
                // docs/guide.md#usage
                """.trimIndent(),
            )
        val result = resolveSourceReference(doc, languageId, "docs/guide.md", "usage")
        assertEquals(1, result.line)
        assertEquals(0, result.character)
        assertTrue(result.anchorFound)
    }

    @Test
    fun `falls back to first file-only reference`() {
        val doc =
            stringDocument(
                """
                // docs/guide.md
                // docs/guide.md#usage
                """.trimIndent(),
            )
        val result = resolveSourceReference(doc, languageId, "docs/guide.md", "missing")
        assertEquals(0, result.line)
        assertFalse(result.anchorFound)
    }

    @Test
    fun `falls back to top of document when file unreferenced`() {
        val doc =
            stringDocument(
                """
                // something else
                // docs/other.md
                """.trimIndent(),
            )
        val result = resolveSourceReference(doc, languageId, "docs/guide.md", "usage")
        assertEquals(0, result.line)
        assertFalse(result.anchorFound)
    }

    @Test
    fun `normalizes leading dot slash on both sides`() {
        val doc = stringDocument("// ./docs/guide.md#usage")
        val result = resolveSourceReference(doc, languageId, "docs/guide.md", "usage")
        assertEquals(0, result.line)
        assertTrue(result.anchorFound)
    }

    @Test
    fun `hasExactSourceReference true on match`() {
        val doc = stringDocument("// docs/guide.md#usage")
        assertTrue(hasExactSourceReference(doc, languageId, "docs/guide.md", "usage"))
    }

    @Test
    fun `hasExactSourceReference false without anchor`() {
        val doc = stringDocument("// docs/guide.md")
        assertFalse(hasExactSourceReference(doc, languageId, "docs/guide.md", "usage"))
    }

    @Test
    fun `hasExactSourceReference false on empty anchor`() {
        val doc = stringDocument("// docs/guide.md#usage")
        assertFalse(hasExactSourceReference(doc, languageId, "docs/guide.md", ""))
    }

    @Test
    fun `listSourceAnchors deduplicates`() {
        val doc =
            stringDocument(
                """
                // docs/guide.md#usage
                // docs/guide.md#usage
                // docs/guide.md#install
                """.trimIndent(),
            )
        val anchors = listSourceAnchors(doc, languageId, "docs/guide.md")
        assertEquals(setOf("usage", "install"), anchors.toSet())
    }

    @Test
    fun `ignores non-documentation references`() {
        val doc = stringDocument("// see #42 and docs/guide.md#usage")
        assertTrue(hasExactSourceReference(doc, languageId, "docs/guide.md", "usage"))
        val anchors = listSourceAnchors(doc, languageId, "docs/guide.md")
        assertEquals(listOf("usage"), anchors)
    }
}
