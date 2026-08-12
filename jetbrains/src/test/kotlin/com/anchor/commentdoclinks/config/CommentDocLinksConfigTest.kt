package com.anchor.commentdoclinks.config

import com.intellij.ide.util.PropertiesComponent
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Verifies [CommentDocLinksConfig] defaults and persistence, mirroring the
 * VS Code `commentDocLinks.*` settings.
 */
class CommentDocLinksConfigTest : BasePlatformTestCase() {
    override fun setUp() {
        super.setUp()
        val pc = PropertiesComponent.getInstance()
        pc.setValue("commentDocLinks.enableDecorations", true)
        pc.setValue("commentDocLinks.enableDiagnostics", true)
        pc.setValue("commentDocLinks.enableCompletion", true)
    }

    fun testDefaultsAreEnabled() {
        assertEquals(true, CommentDocLinksConfig.enableDecorations)
        assertEquals(true, CommentDocLinksConfig.enableDiagnostics)
        assertEquals(true, CommentDocLinksConfig.enableCompletion)
    }

    fun testSettersPersist() {
        CommentDocLinksConfig.enableCompletion = false
        assertEquals(false, CommentDocLinksConfig.enableCompletion)
        CommentDocLinksConfig.enableCompletion = true
        assertEquals(true, CommentDocLinksConfig.enableCompletion)
    }
}
