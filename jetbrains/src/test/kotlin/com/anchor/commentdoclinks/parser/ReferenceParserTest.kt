package com.anchor.commentdoclinks.parser

import com.anchor.commentdoclinks.model.ReferenceType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ReferenceParserTest {
    // ---- detectReferenceSpans ----

    @Test
    fun `detects documentation reference`() {
        val spans = detectReferenceSpans("see documentation/file.md for details")
        assertEquals(1, spans.size)
        assertEquals("documentation/file.md", spans[0].raw)
    }

    @Test
    fun `rejects absolute path`() {
        val spans = detectReferenceSpans("see /Users/me/docs/file.md")
        assertEquals(0, spans.size)
    }

    @Test
    fun `rejects url context`() {
        val spans = detectReferenceSpans("see https://example.com/docs/file.md")
        assertEquals(0, spans.size)
    }

    @Test
    fun `rejects windows path`() {
        val spans = detectReferenceSpans("see C:\\docs\\file.md")
        assertEquals(0, spans.size)
    }

    @Test
    fun `accepts relative dot path`() {
        val spans = detectReferenceSpans("see ./docs/file.md")
        assertEquals(1, spans.size)
        assertEquals("./docs/file.md", spans[0].raw)
    }

    @Test
    fun `documentation wins over issue inside its span`() {
        val spans = detectReferenceSpans("file.md#123")
        assertEquals(1, spans.size)
        assertEquals("file.md#123", spans[0].raw)
    }

    @Test
    fun `detects issue reference`() {
        val spans = detectReferenceSpans("fixes #123 here")
        assertEquals(1, spans.size)
        assertEquals("#123", spans[0].raw)
    }

    @Test
    fun `rejects issue after word char`() {
        val spans = detectReferenceSpans("foo#123")
        assertEquals(0, spans.size)
    }

    // ---- parseReference ----

    @Test
    fun `parses plain documentation reference`() {
        val r = parseReference("documentation/file.md")!!
        assertEquals(ReferenceType.DOCUMENTATION, r.type)
        assertEquals("documentation/file.md", r.file)
        assertNull(r.anchor)
        assertNull(r.line)
    }

    @Test
    fun `parses documentation with anchor`() {
        val r = parseReference("documentation/file.md#anchor")!!
        assertEquals("anchor", r.anchor)
        assertNull(r.line)
    }

    @Test
    fun `parses documentation with dash anchor`() {
        val r = parseReference("documentation/file.md - anchor")!!
        assertEquals("anchor", r.anchor)
    }

    @Test
    fun `parses documentation with em-dash anchor`() {
        val r = parseReference("documentation/file.md — anchor")!!
        assertEquals("anchor", r.anchor)
    }

    @Test
    fun `parses documentation with colon line`() {
        val r = parseReference("documentation/file.md:42")!!
        assertEquals(42, r.line)
        assertNull(r.anchor)
    }

    @Test
    fun `parses documentation with hash line`() {
        val r = parseReference("documentation/file.md#L42")!!
        assertEquals(42, r.line)
    }

    @Test
    fun `parses documentation with lowercase hash line`() {
        val r = parseReference("documentation/file.md#l42")!!
        assertEquals(42, r.line)
    }

    @Test
    fun `hash number is anchor not line`() {
        val r = parseReference("documentation/file.md#42")!!
        assertEquals("42", r.anchor)
        assertNull(r.line)
    }

    @Test
    fun `parses issue reference`() {
        val r = parseReference("#123")!!
        assertEquals(ReferenceType.ISSUE, r.type)
        assertEquals("123", r.identifier)
    }

    @Test
    fun `parses ticket doc reference`() {
        val r = parseReference("DOC-123")!!
        assertEquals(ReferenceType.DOCUMENTATION, r.type)
        assertEquals("DOC-123", r.identifier)
        assertNull(r.file)
    }

    @Test
    fun `rejects ticket with trailing word`() {
        assertNull(parseReference("DOC-123x"))
    }

    @Test
    fun `parses api reference`() {
        val r = parseReference("API:Checkout")!!
        assertEquals(ReferenceType.API, r.type)
        assertEquals("Checkout", r.identifier)
    }

    @Test
    fun `rejects api after word char`() {
        assertNull(parseReference("xAPI:Foo"))
    }

    // ---- parseComment offsets ----

    @Test
    fun `applies offset to spans`() {
        val refs = parseComment("documentation/file.md", offset = 3)
        assertEquals(1, refs.size)
        assertEquals(3, refs[0].start)
        assertEquals(3 + "documentation/file.md".length, refs[0].end)
    }
}
