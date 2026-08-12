package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ReferenceType
import com.anchor.commentdoclinks.model.ResolutionStatus
import kotlin.test.Test
import kotlin.test.assertEquals

class ReferenceValidatorTest {

    private class MapFs(private val files: Map<String, String?>) : FileSystemLike {
        override fun exists(p: String): Boolean = files.containsKey(p)
        override fun readText(p: String): String? = files[p]
    }

    private fun docRef(
        file: String? = null,
        anchor: String? = null,
        line: Int? = null
    ) = ParsedReference(
        type = ReferenceType.DOCUMENTATION,
        raw = file ?: "",
        file = file,
        anchor = anchor,
        line = line,
        identifier = null
    )

    private val guidContent = "## Checkout Flow\n## API & Errors\n"

    @Test
    fun `external when no file`() {
        val r = validateReference(
            ParsedReference(ReferenceType.ISSUE, "#1", null, null, null, "1"),
            { null },
            MapFs(emptyMap())
        )
        assertEquals(ResolutionStatus.EXTERNAL, r.status)
    }

    @Test
    fun `invalid path when resolve returns null`() {
        val r = validateReference(docRef(file = "docs/x.md"), { null }, MapFs(emptyMap()))
        assertEquals(ResolutionStatus.INVALID_PATH, r.status)
        assertEquals("Documentation path is not allowed", r.message)
    }

    @Test
    fun `missing file`() {
        val r = validateReference(docRef(file = "docs/x.md"), { "abs/docs/x.md" }, MapFs(emptyMap()))
        assertEquals(ResolutionStatus.MISSING_FILE, r.status)
        assertEquals("Documentation file not found: docs/x.md", r.message)
    }

    @Test
    fun `valid line in range`() {
        val r = validateReference(
            docRef(file = "g.md", line = 1),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.VALID, r.status)
        assertEquals(1, r.line)
    }

    @Test
    fun `invalid line out of range`() {
        val r = validateReference(
            docRef(file = "g.md", line = 99),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.INVALID_LINE, r.status)
        assertEquals("Documentation line out of range: 99", r.message)
    }

    @Test
    fun `unreadable file is valid even with bad line`() {
        val r = validateReference(
            docRef(file = "g.md", line = 999),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to null))
        )
        assertEquals(ResolutionStatus.VALID, r.status)
    }

    @Test
    fun `valid anchor present`() {
        val r = validateReference(
            docRef(file = "g.md", anchor = "checkout-flow"),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.VALID, r.status)
    }

    @Test
    fun `missing anchor`() {
        val r = validateReference(
            docRef(file = "g.md", anchor = "nope"),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.MISSING_ANCHOR, r.status)
        assertEquals("Documentation anchor not found: nope", r.message)
    }

    @Test
    fun `unreadable file valid even with missing anchor`() {
        val r = validateReference(
            docRef(file = "g.md", anchor = "nope"),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to null))
        )
        assertEquals(ResolutionStatus.VALID, r.status)
    }

    @Test
    fun `valid plain file no anchor no line`() {
        val r = validateReference(
            docRef(file = "g.md"),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.VALID, r.status)
    }

    // ---- line boundary / edge cases (parity with VS Code resolver) ----

    @Test
    fun `first line is valid`() {
        val r = validateReference(docRef(file = "g.md", line = 1), { "abs/g.md" }, MapFs(mapOf("abs/g.md" to guidContent)))
        assertEquals(ResolutionStatus.VALID, r.status)
        assertEquals(1, r.line)
    }

    @Test
    fun `last line is valid`() {
        // guidContent = "## Checkout Flow\n## API & Errors\n" -> 3 lines (trailing newline).
        val r = validateReference(docRef(file = "g.md", line = 3), { "abs/g.md" }, MapFs(mapOf("abs/g.md" to guidContent)))
        assertEquals(ResolutionStatus.VALID, r.status)
        assertEquals(3, r.line)
    }

    @Test
    fun `line beyond eof invalid`() {
        val r = validateReference(docRef(file = "g.md", line = 4), { "abs/g.md" }, MapFs(mapOf("abs/g.md" to guidContent)))
        assertEquals(ResolutionStatus.INVALID_LINE, r.status)
        assertEquals("Documentation line out of range: 4", r.message)
    }

    @Test
    fun `line zero invalid`() {
        val r = validateReference(docRef(file = "g.md", line = 0), { "abs/g.md" }, MapFs(mapOf("abs/g.md" to guidContent)))
        assertEquals(ResolutionStatus.INVALID_LINE, r.status)
    }

    @Test
    fun `negative line invalid`() {
        val r = validateReference(docRef(file = "g.md", line = -5), { "abs/g.md" }, MapFs(mapOf("abs/g.md" to guidContent)))
        assertEquals(ResolutionStatus.INVALID_LINE, r.status)
    }

    @Test
    fun `line takes precedence over missing anchor`() {
        // VS Code validates line before anchor: anchor missing but line valid -> VALID.
        val r = validateReference(
            docRef(file = "g.md", line = 1, anchor = "nope"),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.VALID, r.status)
    }

    @Test
    fun `invalid line reported even when anchor present`() {
        // Line is validated first; an out-of-range line wins over a valid anchor.
        val r = validateReference(
            docRef(file = "g.md", line = 99, anchor = "checkout-flow"),
            { "abs/g.md" },
            MapFs(mapOf("abs/g.md" to guidContent))
        )
        assertEquals(ResolutionStatus.INVALID_LINE, r.status)
    }
}
