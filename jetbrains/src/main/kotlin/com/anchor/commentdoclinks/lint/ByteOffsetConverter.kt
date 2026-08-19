package com.anchor.commentdoclinks.lint

/**
 * Converts the `custom-biome-lint` v1 contract coordinates into IntelliJ
 * Document character offsets.
 *
 * The contract reports 1-based (line, 1-based UTF-8 *byte* column) positions.
 * IntelliJ [com.intellij.openapi.editor.Document] offsets are UTF-16 code-unit
 * character indexes, so a naive `lineStart + column` is WRONG whenever the text
 * before the diagnostic contains non-ASCII content (a char may be 1, 2, 3 or 4
 * UTF-8 bytes but always 1 or 2 Document code units). This converter walks the
 * document text accumulating the UTF-8 byte length of each character position
 * and maps an absolute byte offset back to a character index.
 *
 * Conversion math (from the protocol doc): `byte_offset = line_start[line-1] +
 * (column-1)`, where `line_start[i]` is the byte offset of the first byte of
 * line i+1 (line 1 = 0). We precompute `byteAtChar[i]` = number of UTF-8 bytes
 * preceding character index `i`, then binary-search the character index `j`
 * whose byte span contains the target byte offset.
 */
object ByteOffsetConverter {
    /**
     * Returns an array `a` of length `text.length + 1` where `a[i]` is the
     * number of UTF-8 bytes before character index `i`.
     */
    fun byteIndexByChar(text: String): LongArray {
        val n = text.length
        val arr = LongArray(n + 1)
        var acc = 0L
        for (i in 0 until n) {
            arr[i] = acc
            acc += utf8ByteLength(text, i)
        }
        arr[n] = acc
        return arr
    }

    /**
     * Map a 1-based (line, 1-based byte column) coordinate to a Document
     * character offset.
     *
     * @param lineStartCharOffset Document offset of the first char of [line].
     * @param lineEndCharOffset   Document offset just past the last char of
     *                           [line] (i.e. before the line terminator).
     * @param line               1-based line number.
     * @param byteColumn         1-based UTF-8 byte column.
     * @return Document character offset, or null if out of range. Columns
     *         beyond the line content are clamped to the line end.
     */
    fun toCharOffset(
        text: String,
        byteIndexByChar: LongArray,
        lineStartCharOffset: Int,
        lineEndCharOffset: Int,
        line: Int,
        byteColumn: Int,
    ): Int? {
        if (line < 1 || byteColumn < 1) return null
        if (lineStartCharOffset < 0 || lineStartCharOffset > text.length) return null

        val lineStartByte = byteIndexByChar[lineStartCharOffset]
        val lineEndByte = byteIndexByChar[lineEndCharOffset.coerceAtMost(text.length)]
        val targetByte = (lineStartByte + (byteColumn - 1)).coerceAtMost(lineEndByte)

        // Largest j with byteIndexByChar[j] <= targetByte.
        var lo = 0
        var hi = byteIndexByChar.size - 1
        var ans = lineStartCharOffset.coerceAtLeast(0)
        while (lo <= hi) {
            val mid = (lo + hi) ushr 1
            if (byteIndexByChar[mid] <= targetByte) {
                ans = mid
                lo = mid + 1
            } else {
                hi = mid - 1
            }
        }
        if (ans < 0 || ans > text.length) return null
        return ans
    }

    /**
     * UTF-8 byte length of the code point starting at [text][i].
     *
     * Kotlin [String] iterates UTF-16 code units, so a supplementary code
     * point (e.g. 😀) is two units (a surrogate pair). The pair encodes to a
     * single 4-byte UTF-8 sequence; we attribute those 4 bytes to the HIGH
     * surrogate and 0 to the LOW surrogate, so the code point occupies one
     * contiguous byte range and maps to its two Document code units.
     */
    private fun utf8ByteLength(text: String, i: Int): Int {
        val c = text[i]
        if (c.code < 0x80) return 1
        if (c.isHighSurrogate()) return 4 // surrogate pair -> 4 bytes total
        if (c.isLowSurrogate()) return 0 // bytes already counted on the high surrogate
        if (c.code < 0x800) return 2
        return 3
    }
}
