package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ReferenceType
import com.anchor.commentdoclinks.model.ResolutionStatus
import com.anchor.commentdoclinks.model.stringDocument
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Exercises the EXACT resolver functions the JetBrains IDE calls (validateReference,
 * resolveInRoot, resolveAnchor, parseMarkdownHeading, resolveSourceReference) against
 * REAL files on disk laid out exactly like the user's sandbox:
 *
 *   <root>/.git
 *   <root>/src/util/qrcode.js                  // see documentation/claude/comments/ENC-78186.md#local-qr-auto-size
 *   <root>/documentation/claude/comments/ENC-78186.md
 *        # Local QR Auto Size
 *        ## src/util/qrcode.js#local-qr-auto-size
 *
 * This is the ground truth the IDE relies on (LocalFileSystem.findFileByPath +
 * WorkspaceRootService.findCheckoutRoot), isolated from the in-memory test VFS.
 */
class RealDiskResolutionTest {
    private val sourceText =
        "// see documentation/claude/comments/ENC-78186.md#local-qr-auto-size\n"
    private val docText =
        "# Local QR Auto Size\n\n## src/util/qrcode.js#local-qr-auto-size\n"

    private val realFs =
        object : com.anchor.commentdoclinks.resolver.FileSystemLike {
            override fun exists(targetPath: String): Boolean = File(targetPath).exists()

            override fun readText(targetPath: String): String? = File(targetPath).takeIf { it.exists() }?.readText()
        }

    private fun makeProject(): Pair<File, String> {
        val root = Files.createTempDirectory("cdl-real").toFile()
        File(root, ".git").mkdirs() // mimic sandbox checkout root
        File(root, "src/util").mkdirs()
        File(root, "documentation/claude/comments").mkdirs()
        File(root, "src/util/qrcode.js").writeText(sourceText)
        File(root, "documentation/claude/comments/ENC-78186.md").writeText(docText)
        return root to root.absolutePath
    }

    @Test
    fun forwardSourceCommentResolvesToDocHeading() {
        val (root, rootPath) = makeProject()
        val reference =
            ParsedReference(
                type = ReferenceType.DOCUMENTATION,
                raw = "documentation/claude/comments/ENC-78186.md#local-qr-auto-size",
                file = "documentation/claude/comments/ENC-78186.md",
                anchor = "local-qr-auto-size",
                line = null,
                identifier = null,
            )

        // Mirror WorkspaceRootService.resolveWorkspaceRoot: git root wins.
        val resolvedRoot = findCheckoutRoot(rootPath)!!
        assertTrue("checkout root must be the temp project root", resolvedRoot == rootPath)

        val result = validateReference(reference, { rel -> resolveInRoot(resolvedRoot, rel) }, realFs)
        assertEquals("forward must be VALID", ResolutionStatus.VALID, result.status)
        assertNotNull("forward targetPath must be set", result.targetPath)
        assertTrue(
            "forward target must be the doc file",
            result.targetPath!!.endsWith("documentation/claude/comments/ENC-78186.md"),
        )

        val doc = stringDocument(File(result.targetPath!!).readText())
        val loc = resolveAnchor(doc, "local-qr-auto-size")
        assertNotNull("forward anchor must resolve to the heading", loc)
        // line 0 = title, line 1 = blank, line 2 = the heading
        assertEquals("forward anchor lands on heading line", 2, loc!!.line)
        root.deleteRecursively()
    }

    @Test
    fun backDocHeadingResolvesToSourceComment() {
        val (root, rootPath) = makeProject()
        val docFile = File(root, "documentation/claude/comments/ENC-78186.md")
        val srcFile = File(root, "src/util/qrcode.js")

        val heading = parseMarkdownHeading("## src/util/qrcode.js#local-qr-auto-size")
        assertNotNull("heading must parse", heading)
        assertEquals("source path", "src/util/qrcode.js", heading!!.source)
        assertEquals("anchor", "local-qr-auto-size", heading.anchor)

        val resolvedRoot = findCheckoutRoot(rootPath)!!
        val sourcePath = resolveInRoot(resolvedRoot, heading.source)
        assertNotNull("source path must resolve", sourcePath)
        assertTrue("source path must be the qrcode.js file", sourcePath!!.endsWith("src/util/qrcode.js"))

        val documentationFile = workspaceRelativePath(docFile.absolutePath, resolvedRoot)
        assertEquals(
            "doc workspace-relative path",
            "documentation/claude/comments/ENC-78186.md",
            documentationFile,
        )

        val srcDoc = stringDocument(srcFile.readText())
        val sr = resolveSourceReference(srcDoc, "javascript", documentationFile!!, heading.anchor)
        assertEquals("back must land on the comment line", 0, sr.line)
        assertEquals("back must find the exact anchor", true, sr.anchorFound)
        root.deleteRecursively()
    }
}
