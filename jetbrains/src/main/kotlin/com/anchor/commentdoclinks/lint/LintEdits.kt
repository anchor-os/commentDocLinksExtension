package com.anchor.commentdoclinks.lint

/**
 * Pure, Document-free helper that applies contract [LintEdit]s to a String.
 *
 * Used by unit tests to verify the byte-column -> char-offset -> replace path
 * produces the text the Rust binary's edit intends. The IntelliJ inspection
 * applies the same converted offsets to a live [Document]; both share
 * [ByteOffsetConverter], so this is a faithful proxy for the editor path.
 */
object LintEdits {
    fun apply(text: String, edits: List<LintEdit>): String {
        if (edits.isEmpty()) return text
        val byteIndex = ByteOffsetConverter.byteIndexByChar(text)
        val lineStarts = lineStartOffsets(text)
        val lineEnds = lineEndOffsets(text, lineStarts)
        val converted =
            edits.mapNotNull { edit ->
                val sLine = (edit.startLine - 1).coerceAtLeast(0)
                val eLine = (edit.endLine - 1).coerceAtLeast(0)
                if (sLine >= lineStarts.size || eLine >= lineStarts.size) return@mapNotNull null
                val so =
                    ByteOffsetConverter.toCharOffset(
                        text,
                        byteIndex,
                        lineStarts[sLine],
                        lineEnds[sLine],
                        edit.startLine,
                        edit.startColumn,
                    ) ?: return@mapNotNull null
                val eo =
                    ByteOffsetConverter.toCharOffset(
                        text,
                        byteIndex,
                        lineStarts[eLine],
                        lineEnds[eLine],
                        edit.endLine,
                        edit.endColumn,
                    ) ?: return@mapNotNull null
                if (so > eo) return@mapNotNull null
                EditOffset(so, eo, edit.replacement)
            }
        if (converted.isEmpty()) return text

        val sb = StringBuilder(text)
        for (offset in converted.sortedByDescending { it.start }) {
            sb.replace(offset.start, offset.end, offset.text)
        }
        return sb.toString()
    }

    private data class EditOffset(
        val start: Int,
        val end: Int,
        val text: String,
    )

    private fun lineStartOffsets(text: String): IntArray {
        val starts = mutableListOf(0)
        for (i in text.indices) {
            if (text[i] == '\n') starts += i + 1
        }
        return starts.toIntArray()
    }

    private fun lineEndOffsets(
        text: String,
        lineStarts: IntArray,
    ): IntArray {
        val ends = IntArray(lineStarts.size)
        for (i in lineStarts.indices) {
            ends[i] = if (i + 1 < lineStarts.size) lineStarts[i + 1] - 1 else text.length
        }
        return ends
    }
}
