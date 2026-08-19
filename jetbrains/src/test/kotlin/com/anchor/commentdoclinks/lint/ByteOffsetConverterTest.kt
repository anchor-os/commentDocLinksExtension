package com.anchor.commentdoclinks.lint

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Verifies the contract's UTF-8 byte-column -> IntelliJ char-offset
 * conversion, including files with non-ASCII content BEFORE the diagnostic
 * (the critical acceptance criterion).
 *
 * IntelliJ Document offsets are UTF-16 code-unit indexes, while the contract
 * reports 1-based UTF-8 byte columns. A char's byte length (1/2/3/4) generally
 * differs from its Document code-unit length, so the naive `lineStart + column`
 * would be wrong here.
 */
class ByteOffsetConverterTest {
    private fun convert(
        text: String,
        line: Int,
        byteColumn: Int,
    ): Int {
        val byteIndex = ByteOffsetConverter.byteIndexByChar(text)
        // Replicate IntelliJ Document line boundaries for the given 1-based line.
        val lines = text.split("\n")
        var lineStart = 0
        for (i in 0 until (line - 1).coerceAtLeast(0)) lineStart += lines[i].length + 1
        val lineEnd = if (line - 1 < lines.size) lineStart + lines[line - 1].length else text.length
        return ByteOffsetConverter.toCharOffset(text, byteIndex, lineStart, lineEnd, line, byteColumn)!!
    }

    @Test
    fun `ascii single line round trips`() {
        val text = "hello world"
        // h(1) e(2) l(3) l(4) o(5) (6) w(7) ...
        assertEquals(0, convert(text, 1, 1)) // 'h'
        assertEquals(4, convert(text, 1, 5)) // 'o'
        assertEquals(6, convert(text, 1, 7)) // 'w'
        assertEquals(text.length, convert(text, 1, text.length + 1)) // past end clamps to EOL
    }

    @Test
    fun `two lines ascii`() {
        val text = "abc\ndef"
        // line 1 = "abc" (chars 0..2, '\n' at 3); line 2 = "def" (chars 4..6).
        assertEquals(4, convert(text, 2, 1)) // 'd'
        assertEquals(5, convert(text, 2, 2)) // 'e'
        assertEquals(6, convert(text, 2, 3)) // 'f'
    }

    @Test
    fun `latin1 multibyte char before diagnostic`() {
        // 'é' is 2 UTF-8 bytes but 1 Document code unit (index 0).
        val text = "é"
        assertEquals(0, convert(text, 1, 1)) // byte 0 -> char 0
        assertEquals(0, convert(text, 1, 2)) // byte 1 still within 'é' -> char 0
        assertEquals(1, convert(text, 1, 3)) // byte 2 -> char 1 (end)
    }

    @Test
    fun `cjk multibyte char before diagnostic`() {
        // '你' is 3 UTF-8 bytes, 1 Document code unit (index 0).
        val text = "你"
        assertEquals(0, convert(text, 1, 1))
        assertEquals(0, convert(text, 1, 2))
        assertEquals(0, convert(text, 1, 3))
        assertEquals(1, convert(text, 1, 4)) // byte 3 -> char 1 (end)
    }

    @Test
    fun `mixed ascii and multibyte, diagnostic after them`() {
        // a(1B) 你(3B) b(1B) => bytes: a[0], 你[1..3], b[4]; char idx: a0,你1,b2
        val text = "a你b"
        assertEquals(0, convert(text, 1, 1)) // 'a'
        assertEquals(1, convert(text, 1, 2)) // first byte of 你
        assertEquals(1, convert(text, 1, 3)) // still 你
        assertEquals(1, convert(text, 1, 4)) // last byte of 你
        assertEquals(2, convert(text, 1, 5)) // 'b'
        assertEquals(3, convert(text, 1, 6)) // end (clamped to EOL)
    }

    @Test
    fun `emoji surrogate pair counts as 4 bytes`() {
        // '😀' is 4 UTF-8 bytes, 2 Document code units (surrogate pair).
        val text = "😀"
        assertEquals(0, convert(text, 1, 1))
        assertEquals(0, convert(text, 1, 4))
        assertEquals(2, convert(text, 1, 5)) // byte 4 -> char 2 (end, after surrogate pair)
    }

    @Test
    fun `non-ascii before diagnostic shifts byte column relative to char offset`() {
        // 'é' (2 bytes) then "xy" => diagnostic at char 2 ('y') is byte column 4.
        val text = "éxy"
        assertEquals(2, convert(text, 1, 4)) // byte 3 -> char index 2 ('y')
        // naive lineStart+column would have given 3 (wrong); converter gives 2.
    }

    /**
     * Applying a contract [LintEdit] must produce exactly the text the Rust
     * binary's edit intends — i.e. what `--auto-fix`/`--write-fix` would write.
     * This validates the full byte-column -> char-offset -> replace path on a
     * file with non-ASCII content before the edit.
     */
    @Test
    fun `applied edit matches intended replacement on unicode text`() {
        // 'é' (2 bytes) at char 0, then ascii from char 1. "const x" spans
        // chars 1..7. Because of the leading 'é', the byte column for char 1
        // is 3 (1-based), not 2 — this is exactly the offset the converter
        // must get right for non-ASCII content *before* the edit.
        val text = "éconst x = new Map()"
        val edit =
            LintEdit(
                startLine = 1,
                startColumn = 3, // byte 2 -> char 1 ('c' of "const")
                endLine = 1,
                endColumn = 10, // byte 9 -> char 8 (just past 'x')
                replacement = "Immutable.Map",
            )
        val result = LintEdits.apply(text, listOf(edit))
        assertEquals("éImmutable.Map = new Map()", result)
    }

    @Test
    fun `insertion edit is zero width and applied verbatim`() {
        // "const x = new Map()" is 20 chars; a trailing insertion is byte
        // column 21 (1-based) == char offset 20 (end of line).
        val text = "const x = new Map()"
        val edit =
            LintEdit(
                startLine = 1,
                startColumn = 21, // byte 20 (end), zero-width insertion
                endLine = 1,
                endColumn = 21,
                replacement = " // custom-biome-ignore-line no-native-map",
            )
        val result = LintEdits.apply(text, listOf(edit))
        assertEquals("const x = new Map() // custom-biome-ignore-line no-native-map", result)
    }
}
