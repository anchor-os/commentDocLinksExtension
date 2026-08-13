package com.anchor.commentdoclinks.decorations

import com.anchor.commentdoclinks.FakeFileSystem
import com.anchor.commentdoclinks.model.stringDocument
import com.intellij.lang.annotation.HighlightSeverity
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Markdown source-reference diagnostics (Phase 12): a `## src/file.js — anchor`
 * heading should warn when the source file lacks a comment referencing the doc
 * with that anchor, and error when the source file is missing. Tests the pure
 * [markdownSourceDiagnostics] directly (the annotator is a thin caller).
 */
class CommentDocLinkAnnotatorTest {

    private fun diagnostics(
        docText: String,
        sourceFiles: Map<String, String>
    ): List<MarkdownSourceDiagnostic> =
        markdownSourceDiagnostics(
            doc = stringDocument(docText),
            root = "/repo",
            fs = FakeFileSystem(sourceFiles),
            documentationFile = "doc.md"
        )

    @Test
    fun testMissingSourceFileErrors() {
        val diags = diagnostics("## src/app.js — checkout-flow\n", emptyMap())
        assertNotNull(
            "expected an error for a missing source file",
            diags.firstOrNull {
                it.severity == HighlightSeverity.ERROR && it.message.contains("Source file not found")
            }
        )
    }

    @Test
    fun testMissingSourceAnchorWarns() {
        val diags = diagnostics(
            "## src/app.js — missing-anchor\n",
            mapOf("/repo/src/app.js" to "// doc.md#checkout-flow\n")
        )
        assertNotNull(
            "expected a warning for a missing source anchor",
            diags.firstOrNull {
                it.severity == HighlightSeverity.WARNING && it.message.contains("Source anchor not found")
            }
        )
    }

    @Test
    fun testPresentSourceAnchorHasNoWarning() {
        val diags = diagnostics(
            "## src/app.js — checkout-flow\n",
            mapOf("/repo/src/app.js" to "// doc.md#checkout-flow\n")
        )
        assertNull(
            "expected no warning when the source anchor is present",
            diags.firstOrNull {
                it.severity == HighlightSeverity.WARNING && it.message.contains("Source anchor not found")
            }
        )
    }
}
