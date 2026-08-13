package com.anchor.commentdoclinks.resolver

import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.ExperimentalPathApi
import kotlin.io.path.deleteRecursively
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

@OptIn(ExperimentalPathApi::class)
class PathResolutionTest {

    private fun tempDir(): Path = Files.createTempDirectory("cdl-test")

    @Test
    fun `resolveInRoot keeps path inside root`() {
        val root = tempDir()
        try {
            val resolved = resolveInRoot(root.toString(), "docs/guide.md")
            assertEquals(root.toRealPath().resolve("docs/guide.md").toString(), resolved)
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun `resolveInRoot rejects escaping path`() {
        val root = tempDir()
        try {
            assertNull(resolveInRoot(root.toString(), "../secrets.txt"))
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun `resolveInRoot rejects absolute path outside root`() {
        val root = tempDir()
        try {
            // An absolute target with a different root must return null, never
            // throw IllegalArgumentException from relativize.
            assertNull(resolveInRoot(root.toString(), "/etc/passwd"))
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun `resolveInRoot allows not-yet-created files`() {
        val root = tempDir()
        try {
            Files.createDirectories(root.resolve("docs"))
            val resolved = resolveInRoot(root.toString(), "docs/new.md")
            assertEquals(root.toRealPath().resolve("docs/new.md").toString(), resolved)
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun `findCheckoutRoot finds main repo`() {
        val root = tempDir()
        try {
            Files.createDirectory(root.resolve(".git"))
            Files.createDirectories(root.resolve("src/foo"))
            val found = findCheckoutRoot(root.resolve("src/foo").toString())
            assertEquals(root.toString(), found)
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun `findCheckoutRoot prefers nested worktree gitfile`() {
        val repo = tempDir()
        try {
            Files.createDirectory(repo.resolve(".git"))
            val wt = repo.resolve("worktrees/A")
            Files.createDirectories(wt.resolve("src"))
            // linked worktree .git is a regular file (gitfile)
            Files.createFile(wt.resolve(".git"))
            val found = findCheckoutRoot(wt.resolve("src").toString())
            assertEquals(wt.toString(), found)
        } finally {
            repo.deleteRecursively()
        }
    }

    @Test
    fun `chooseRoot picks deepest containing root`() {
        val repo = tempDir()
        try {
            Files.createDirectory(repo.resolve(".git"))
            val wt = repo.resolve("worktrees/A")
            Files.createDirectories(wt.resolve("src"))
            Files.createFile(wt.resolve(".git"))

            val context = wt.resolve("src/file.js").toString()
            val chosen = chooseRoot(
                listOf(repo.toString(), wt.toString()),
                context
            )
            assertEquals(wt.toString(), chosen)
        } finally {
            repo.deleteRecursively()
        }
    }

    @Test
    fun `workspaceRelativePath uses forward slashes`() {
        val root = tempDir()
        try {
            val file = root.resolve("docs").resolve("guide.md")
            Files.createDirectories(file.parent)
            Files.createFile(file)
            assertEquals("docs/guide.md", workspaceRelativePath(file.toString(), root.toString()))
        } finally {
            root.deleteRecursively()
        }
    }
}
