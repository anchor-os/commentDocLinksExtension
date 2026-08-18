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

    /**
     * Exercises the exact reference-resolution path the IDE runs on Ctrl/Cmd+Click:
     * the contributor builds a [PsiReference] whose range covers the link text in
     * the comment, and [PsiReference.resolve] must return the doc target. If the
     * range were line-relative (buggy), the caret over the link would fall outside
     * the reference and Ctrl+Click would find nothing.
     *
     * NOTE: wiring through plugin.xml (psi.referenceContributor) cannot be
     * verified in this BasePlatformTestCase harness because the harness does not
     * load our plugin.xml extensions (the platform's own reference contributors
     * load, ours do not). The standard PsiReferenceContributor pattern used in
     * plugin.xml is identical to those, so registration in the real IDE is
     * expected; verify in WebStorm via the log lines "CDL CONTRIB"/"CDL FORWARD".
     */
    fun testReferenceAtCaretResolves() {
        File("/tmp/heavy.log").appendText("--- testReferenceAtCaretResolves ---\n")
        val src = myFixture.configureByText(
            "qrcode.js",
            "// see documentation/claude/comments/ENC-78186.md#local-qr-auto-size\n",
        )
        val refs = CommentDocReferenceContributor().referencesForFile(src)
        assertTrue("expected a reference on the comment line", refs.isNotEmpty())
        val caret = src.text.indexOf("ENC-78186") + 3
        val refAtCaret = refs.firstOrNull { it.rangeInElement.contains(caret) }
        log("CARET refAtCaret=${refAtCaret?.javaClass?.simpleName} range=${refAtCaret?.rangeInElement}")
        assertNotNull("reference range must contain the caret over the link", refAtCaret)
        // (In-memory configureByText has no real doc target on disk, so resolve()
        // returning null here is expected. The full resolve path — including the
        // VfsFileSystem refresh fix — is covered by
        // testForwardAndBackResolveOnRealDiskProject, which writes real files.)
    }
}
