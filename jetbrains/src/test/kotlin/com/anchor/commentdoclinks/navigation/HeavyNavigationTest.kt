package com.anchor.commentdoclinks.navigation

import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import java.io.File

/**
 * Boots a REAL IntelliJ project on REAL disk (BasePlatformTestCase's temp
 * project directory) laid out exactly like the user's sandbox, then exercises
 * the full contributor -> resolve() path the IDE runs on Ctrl/Cmd+Click.
 *
 * Unlike the pure resolver test, files live on the real filesystem so
 * LocalFileSystem.findFileByPath + PsiManager.findFile behave exactly like the
 * sandbox. If resolve() returns null here, we have reproduced the real bug.
 */
class HeavyNavigationTest : BasePlatformTestCase() {
    private val sourceText =
        "// see documentation/claude/comments/ENC-78186.md#local-qr-auto-size\n"
    private val docText =
        "# Local QR Auto Size\n\n## src/util/qrcode.js#local-qr-auto-size\n"

    private fun log(msg: String) {
        File("/tmp/heavy.log").appendText(msg + "\n")
    }

    private fun writeReal(path: String, text: String): String {
        val f = File(myFixture.tempDirPath, path)
        f.parentFile.mkdirs()
        f.writeText(text)
        LocalFileSystem.getInstance().refreshAndFindFileByIoFile(f)
        return f.absolutePath
    }

    fun testForwardAndBackResolveOnRealDiskProject() {
        File("/tmp/heavy.log").writeText("")
        val root = myFixture.tempDirPath
        // mimic sandbox git checkout root so WorkspaceRootService.findCheckoutRoot works
        File(root, ".git").mkdirs()
        log("project basePath=${myFixture.project.basePath}")
        log("tempDirPath=$root")

        val srcAbs = writeReal("src/util/qrcode.js", sourceText)
        val docAbs = writeReal("documentation/claude/comments/ENC-78186.md", docText)

        // FORWARD: source comment -> doc
        val srcVf = LocalFileSystem.getInstance().findFileByPath(srcAbs)!!
        val srcPsi = myFixture.psiManager.findFile(srcVf)!!
        val fwdRefs = CommentDocReferenceContributor().referencesForFile(srcPsi)
        log("FORWARD refs=${fwdRefs.size}")
        assertTrue("forward reference should be created", fwdRefs.isNotEmpty())
        val fwdTarget = fwdRefs.first().resolve()
        log("FORWARD resolved=${fwdTarget} targetFile=${fwdTarget?.containingFile?.name}")
        assertNotNull("FORWARD must resolve to the doc file", fwdTarget)

        // BACK: doc heading -> source
        val docVf = LocalFileSystem.getInstance().findFileByPath(docAbs)!!
        val docPsi = myFixture.psiManager.findFile(docVf)!!
        val backRefs = MarkdownSourceLinkContributor().referencesForFile(docPsi)
        log("BACK refs=${backRefs.size}")
        assertTrue("back reference should be created", backRefs.isNotEmpty())
        val backTarget = backRefs.first().resolve()
        log("BACK resolved=${backTarget} targetFile=${backTarget?.containingFile?.name}")
        assertNotNull("BACK must resolve to the source file", backTarget)
    }

    fun testSetextBackResolveOnRealDiskProject() {
        val root = myFixture.tempDirPath
        File(root, ".git").mkdirs()
        val sourceText =
            "// see documentation/claude/comments/ENC-78186.md#local-qr-auto-size\n"
        val srcAbs = writeReal("src/util/qrcode.js", sourceText)

        // Setext level 2 (dash underline)
        val l2 = "src/util/qrcode.js#local-qr-auto-size\n-----------------------------------\n"
        assertSetextResolves(writeReal("documentation/claude/comments/setext2.md", l2), srcAbs)

        // Setext level 1 (equals underline)
        val l1 = "src/util/qrcode.js#local-qr-auto-size\n===================================\n"
        assertSetextResolves(writeReal("documentation/claude/comments/setext1.md", l1), srcAbs)
    }

    private fun assertSetextResolves(docAbs: String, srcAbs: String) {
        val docVf = LocalFileSystem.getInstance().findFileByPath(docAbs)!!
        val docPsi = myFixture.psiManager.findFile(docVf)!!
        val backRefs = MarkdownSourceLinkContributor().referencesForFile(docPsi)
        assertTrue("setext back reference should be created", backRefs.isNotEmpty())
        val backTarget = backRefs.first().resolve()
        assertNotNull("SETEXT must resolve to the source file", backTarget)
        assertEquals(
            "SETEXT must resolve to src/util/qrcode.js",
            srcAbs,
            backTarget?.containingFile?.virtualFile?.path,
        )
    }
}
