package com.anchor.commentdoclinks.parser

import com.anchor.commentdoclinks.model.ReferenceType
import com.anchor.commentdoclinks.model.stringDocument
import kotlin.test.Test
import kotlin.test.assertEquals

class DocumentScannerTest {
    @Test
    fun `ignores unsupported language`() {
        val doc = stringDocument("see docs/file.md in a comment")
        val results = scanDocumentForReferences(doc, "plaintext")
        assertEquals(0, results.size)
    }

    @Test
    fun `finds reference only inside slash comment`() {
        val doc =
            stringDocument(
                """
                const x = "docs/file.md"; // docs/guide.md
                """.trimIndent(),
            )
        val results = scanDocumentForReferences(doc, "javascript")
        assertEquals(1, results.size)
        assertEquals("docs/guide.md", results[0].reference.file)
        assertEquals(0, results[0].line)
    }

    @Test
    fun `does not find reference in string literal`() {
        val doc = stringDocument("""const x = "docs/file.md";""")
        val results = scanDocumentForReferences(doc, "javascript")
        assertEquals(0, results.size)
    }

    @Test
    fun `reports correct 0-based line`() {
        val doc =
            stringDocument(
                """
                line0
                line1 // docs/guide.md
                line2
                """.trimIndent(),
            )
        val results = scanDocumentForReferences(doc, "javascript")
        assertEquals(1, results.size)
        assertEquals(1, results[0].line)
    }

    @Test
    fun `carries absolute offset within line`() {
        val doc = stringDocument("//   docs/guide.md")
        val results = scanDocumentForReferences(doc, "javascript")
        assertEquals(1, results.size)
        assertEquals("docs/guide.md", results[0].reference.file)
        assertEquals(5, results[0].reference.start)
        assertEquals(18, results[0].reference.end)
    }

    @Test
    fun `parses issue and documentation within same comment`() {
        val doc = stringDocument("// see docs/guide.md and issue #42")
        val results = scanDocumentForReferences(doc, "javascript")
        assertEquals(2, results.size)
        val types = results.map { it.reference.type }.toSet()
        assertEquals(setOf(ReferenceType.DOCUMENTATION, ReferenceType.ISSUE), types)
    }

    @Test
    fun `markdown whole-line comment scans prose`() {
        val doc = stringDocument("See docs/guide.md for context.")
        val results = scanDocumentForReferences(doc, "markdown")
        assertEquals(1, results.size)
        assertEquals("docs/guide.md", results[0].reference.file)
    }
}
