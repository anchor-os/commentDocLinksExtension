package com.anchor.commentdoclinks.resolver

import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * True when [directory] contains a `.git` entry — a directory (main checkout)
 * OR a regular file (linked worktree / submodule gitfile). Never assume `.git`
 * is a directory.
 */
fun hasGitEntry(directory: String): Boolean {
    val gitPath = Paths.get(directory, ".git")
    return try {
        Files.isDirectory(gitPath) || Files.isRegularFile(gitPath)
    } catch (_: Exception) {
        false
    }
}

/**
 * Find the nearest git checkout root (main repo or linked worktree) that
 * contains [directory]. Walks up from [directory] until an ancestor contains a
 * `.git` entry; the first match wins, so a worktree nested inside a larger
 * repository resolves to the worktree root.
 *
 * @param hasEntry predicate used to detect a checkout root. Defaults to a real
 *   file-system check for a `.git` entry.
 */
fun findCheckoutRoot(
    directory: String,
    hasEntry: (String) -> Boolean = ::hasGitEntry
): String? {
    var current = Paths.get(directory).toAbsolutePath().normalize()
    while (true) {
        if (hasEntry(current.toString())) return current.toString()
        val parent = current.parent ?: return null
        current = parent
    }
}

private data class RealpathResult(val path: String, val suffix: List<String>)

/**
 * Real path of the deepest existing ancestor of [candidate], plus the
 * non-existing path components below it (so not-yet-created files resolve
 * against the real parent and keep their trailing, uncreated segments).
 */
private fun realpathPrefix(candidate: String): RealpathResult? {
    var current = Paths.get(candidate).normalize()
    val suffix = mutableListOf<String>()
    while (true) {
        val real = try {
            current.toRealPath().toString()
        } catch (_: Exception) {
            null
        }
        if (real != null) return RealpathResult(real, suffix.toList())
        val parent = current.parent ?: return null
        suffix.add(0, current.fileName?.toString() ?: "")
        current = parent
    }
}

private fun escapesRoot(relative: Path): Boolean =
    relative.isAbsolute ||
        relative.startsWith(Paths.get("..")) ||
        relative.toString() == ".."

/**
 * Resolve [relativePath] against [root], rejecting paths that escape the root.
 *
 * The check is two-fold: the path must stay inside the root lexically, and —
 * once symbolic links are followed — it must stay inside the root physically.
 * A symlink inside the workspace that points outside therefore cannot be used
 * to reach files beyond the root.
 *
 * Paths that do not exist yet are allowed: the deepest existing ancestor is
 * resolved physically and the remainder is appended lexically.
 *
 * @return the resolved absolute path, or null when it escapes the root.
 */
fun resolveInRoot(root: String, relativePath: String): String? {
    val normalizedRoot = Paths.get(root).toAbsolutePath().normalize().toString()
    val base = Paths.get(normalizedRoot)
    val resolved = base.resolve(relativePath).normalize()

    val lexical = try {
        base.relativize(resolved)
    } catch (_: IllegalArgumentException) {
        return null
    }
    if (escapesRoot(lexical)) return null

    val rootReal = realpathPrefix(normalizedRoot) ?: return null
    val targetReal = realpathPrefix(resolved.toString()) ?: return null

    val physical = try {
        Paths.get(rootReal.path).relativize(Paths.get(targetReal.path))
    } catch (_: IllegalArgumentException) {
        return null
    }
    if (escapesRoot(physical)) return null

    return Paths.get(targetReal.path, *targetReal.suffix.toTypedArray()).toString()
}

/**
 * True when [candidate] is [target] or an ancestor of [target].
 */
private fun isAncestor(candidate: String, target: String): Boolean {
    val cand = Paths.get(candidate).toAbsolutePath().normalize()
    val tgt = Paths.get(target).toAbsolutePath().normalize()
    val relative = try {
        cand.relativize(tgt)
    } catch (_: Exception) {
        return false
    }
    val text = relative.toString()
    return text == "" ||
        (!text.startsWith("..${File.separator}") && text != ".." && !relative.isAbsolute)
}

/**
 * Pick the most specific root for a referencing document.
 *
 * Among candidate roots, the deepest root that still contains the document
 * wins. This keeps links pointing at the copy of the file inside a linked
 * worktree when the worktree is nested inside the workspace folder.
 *
 * @param contextPath file system path of the referencing document.
 */
fun chooseRoot(roots: List<String>, contextPath: String?): String? {
    val candidates = roots.map { Paths.get(it).toAbsolutePath().normalize().toString() }
    if (contextPath == null || candidates.size <= 1) return candidates.firstOrNull()

    val context = Paths.get(contextPath).toAbsolutePath().normalize().toString()
    var best: String? = null
    for (candidate in candidates) {
        if (!isAncestor(candidate, context)) continue
        if (best == null || candidate.length > best.length) best = candidate
    }
    return best ?: candidates.firstOrNull()
}

/**
 * Relative path of [fsPath] from [root], normalized to forward slashes.
 * Returns null when [fsPath] is not under [root].
 */
fun workspaceRelativePath(fsPath: String, root: String): String? {
    val r = Paths.get(root).toAbsolutePath().normalize()
    val p = Paths.get(fsPath).toAbsolutePath().normalize()
    val relative = try {
        r.relativize(p)
    } catch (_: Exception) {
        return null
    }
    val text = relative.toString()
    if (text == "" || text.startsWith("..${File.separator}") || text == ".." || relative.isAbsolute) {
        return null
    }
    return text.replace("\\", "/")
}
