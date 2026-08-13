package com.anchor.commentdoclinks.resolver

import kotlin.test.Test
import kotlin.test.assertEquals

class LineCounterTest {
    @Test
    fun `counts lf lines`() {
        assertEquals(2, countLines("a\nb"))
    }

    @Test
    fun `counts crlf and bare cr like lf`() {
        assertEquals(2, countLines("a\r\nb"))
        assertEquals(2, countLines("a\rb"))
    }

    @Test
    fun `trailing newline yields extra empty line`() {
        assertEquals(3, countLines("a\nb\n"))
    }

    @Test
    fun `empty text is one line`() {
        assertEquals(1, countLines(""))
    }
}
