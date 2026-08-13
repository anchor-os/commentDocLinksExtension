package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.stringDocument
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class AnchorResolverTest {
    @Test
    fun `slug trims and lowercases`() {
        assertEquals("checkout-flow", markdownSlug("Checkout Flow!"))
    }

    @Test
    fun `slug strips punctuation keeps hyphen`() {
        // The `&` removal leaves two spaces, collapsed to two hyphens.
        assertEquals("api--errors", markdownSlug("API & Errors"))
    }

    @Test
    fun `slug handles unicode letters`() {
        assertEquals("café-flow", markdownSlug("Café Flow"))
    }

    @Test
    fun `explicit heading wins over slug`() {
        val doc =
            stringDocument(
                """
                # Title
                ## src/cart.js — checkout-flow
                ## Checkout Flow
                """.trimIndent(),
            )
        val loc = resolveAnchor(doc, "checkout-flow")!!
        // explicit heading is at line 1
        assertEquals(1, loc.line)
    }

    @Test
    fun `html anchor resolves`() {
        val doc =
            stringDocument(
                """
                <a id="legacy-anchor"></a>
                ## Section
                """.trimIndent(),
            )
        val loc = resolveAnchor(doc, "legacy-anchor")!!
        assertEquals(0, loc.line)
    }

    @Test
    fun `plain heading slug resolves`() {
        val doc = stringDocument("## Checkout Flow\n## API & Errors\n")
        assertEquals(0, resolveAnchor(doc, "checkout-flow")!!.line)
        assertEquals(1, resolveAnchor(doc, "api--errors")!!.line)
    }

    @Test
    fun `duplicate slugs get numeric suffixes`() {
        val doc = stringDocument("## Foo\n## Foo\n## Foo\n")
        val anchors = listAnchors(doc)
        assertEquals(listOf("foo", "foo-1", "foo-2"), anchors)
    }

    @Test
    fun `literal dash suffix does not collide with generated`() {
        val doc = stringDocument("## Foo-1\n## Foo\n## Foo\n")
        val anchors = listAnchors(doc)
        assertEquals(listOf("foo-1", "foo", "foo-2"), anchors)
    }

    @Test
    fun `missing anchor returns null`() {
        val doc = stringDocument("## Checkout Flow\n")
        assertNull(resolveAnchor(doc, "nope"))
    }

    @Test
    fun `empty anchor returns null`() {
        val doc = stringDocument("## Checkout Flow\n")
        assertNull(resolveAnchor(doc, ""))
    }
}
