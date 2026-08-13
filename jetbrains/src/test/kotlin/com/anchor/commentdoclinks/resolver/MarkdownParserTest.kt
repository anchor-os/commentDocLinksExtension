package com.anchor.commentdoclinks.resolver

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class MarkdownParserTest {
    @Test
    fun `parses em dash heading`() {
        val h = parseMarkdownHeading("## src/checkout/cart.js — checkout-flow")!!
        assertEquals("src/checkout/cart.js", h.source)
        assertEquals("checkout-flow", h.anchor)
    }

    @Test
    fun `parses dash heading`() {
        val h = parseMarkdownHeading("## src/checkout/cart.js - checkout-flow")!!
        assertEquals("src/checkout/cart.js", h.source)
        assertEquals("checkout-flow", h.anchor)
    }

    @Test
    fun `parses hash heading`() {
        val h = parseMarkdownHeading("## src/checkout/cart.js#checkout-flow")!!
        assertEquals("src/checkout/cart.js", h.source)
        assertEquals("checkout-flow", h.anchor)
    }

    @Test
    fun `source span excludes separator and anchor`() {
        val line = "## src/checkout/cart.js — checkout-flow"
        val h = parseMarkdownHeading(line)!!
        assertEquals(line.indexOf("src/checkout/cart.js"), h.start)
        assertEquals(line.indexOf("src/checkout/cart.js") + "src/checkout/cart.js".length, h.end)
    }

    @Test
    fun `rejects level one heading`() {
        assertNull(parseMarkdownHeading("# src/checkout/cart.js — checkout-flow"))
    }

    @Test
    fun `rejects heading without anchor separator`() {
        assertNull(parseMarkdownHeading("## just a normal heading"))
    }
}
