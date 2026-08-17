package com.anchor.commentdoclinks.navigation

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

/**
 * `CommentDocReferenceContributor` wires scanner output (line-relative offsets)
 * into IntelliJ PSI references (document-absolute ranges). A regression here
 * silently breaks every source→doc link that is not on the first line.
 */
class CommentDocReferenceContributorTest : BasePlatformTestCase() {
    fun testReferenceRangeIsDocumentAbsoluteForNonFirstLine() {
        // 15 blank lines push the externalized-comment link to line index 15
        // (1-based line 16), mirroring the real
        // `applyFeeRuleCancellationFee.js` layout where the pointer lives in a
        // JSDoc block comment far from the top of the file.
        val leading = (1..15).joinToString("\n") { "" }
        val commentLine = "// see documentation/claude/comments/ENC-78673-78674.md#refund-untouched\n"
        val text = "$leading\n$commentLine"
        val file = myFixture.configureByText("applyFeeRuleCancellationFee.js", text)

        val refs = CommentDocReferenceContributor().referencesForFile(file)
        assertTrue("expected a reference on the externalized-comment line", refs.isNotEmpty())

        val range = refs.first().rangeInElement
        // Line index 15 starts at document offset 15; the `documentation` text
        // begins at line offset 7. A document-absolute range starts at 22.
        // A line-relative (buggy) range would start at ~7 and fail this check.
        assertEquals(
            "range must be document-absolute for a non-first line",
            15 + commentLine.indexOf("documentation"),
            range.startOffset,
        )
    }

    fun testReferenceRangeOnFirstLineNeedsNoShift() {
        val commentLine = "// see documentation/claude/comments/ENC-78673-78674.md#refund-untouched\n"
        val file = myFixture.configureByText("applyFeeRuleCancellationFee.js", commentLine)

        val refs = CommentDocReferenceContributor().referencesForFile(file)
        assertTrue(refs.isNotEmpty())

        val range = refs.first().rangeInElement
        assertEquals(
            "first-line range is already absolute (line offset 0)",
            commentLine.indexOf("documentation"),
            range.startOffset,
        )
    }
}
