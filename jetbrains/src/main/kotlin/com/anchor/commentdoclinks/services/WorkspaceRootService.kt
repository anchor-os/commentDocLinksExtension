package com.anchor.commentdoclinks.services

import com.anchor.commentdoclinks.resolver.chooseRoot
import com.anchor.commentdoclinks.resolver.findCheckoutRoot
import com.anchor.commentdoclinks.resolver.workspaceRelativePath
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.vfs.VirtualFile
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentMap

/**
 * Determines the root directory that documentation links in a source file
 * resolve against, and produces the workspace-relative path of that source
 * file for reverse navigation.
 *
 * The document's nearest git checkout root (main repo or linked worktree)
 * wins when it is more specific than the project base directory; otherwise the
 * project base directory is used. The pure `chooseRoot`/`findCheckoutRoot`
 * algorithm from [com.anchor.commentdoclinks.resolver] remains the core; this
 * service only supplies the IntelliJ-side inputs (project base path and the
 * referencing file's path) and consumes the result.
 */
class WorkspaceRootService(
    private val project: Project,
) {
    /**
     * Resolved root per document path. Git checkout roots are stable within a
     * session, so caching avoids re-walking `.git` up the directory tree on
     * every annotator/completion pass (which run on the EDT while typing).
     */
    private val rootCache: ConcurrentMap<String, String> =
        project.getUserData(ROOT_CACHE_KEY)
            ?: ConcurrentHashMap<String, String>().also { project.putUserData(ROOT_CACHE_KEY, it) }

    /**
     * Root that links in [documentFile] resolve against, or null when it
     * cannot be determined.
     */
    fun resolveWorkspaceRoot(documentFile: VirtualFile): String? {
        val path = documentFile.path
        rootCache[path]?.let { return if (it == NO_ROOT) null else it }

        val roots = mutableListOf<String>()
        project.basePath?.let { roots.add(it) }

        val dir = documentFile.parent?.path ?: documentFile.path
        val checkout = findCheckoutRoot(dir)
        if (checkout != null) roots.add(checkout)

        val result = if (roots.isEmpty()) null else chooseRoot(roots, path)
        rootCache[path] = result ?: NO_ROOT
        return result
    }

    /**
     * Workspace-relative slash path of [documentFile] from its resolution root.
     * Falls back to the project-relative path, then to the raw path, when the
     * file is not under any determinable root.
     */
    fun workspaceRelativePath(documentFile: VirtualFile): String {
        val root = resolveWorkspaceRoot(documentFile)
        val candidate = root ?: project.basePath
        if (candidate != null) {
            return com.anchor.commentdoclinks.resolver.workspaceRelativePath(
                documentFile.path,
                candidate,
            ) ?: documentFile.path
        }
        return documentFile.path
    }

    companion object {
        private const val NO_ROOT = ""
        private val ROOT_CACHE_KEY = Key.create<ConcurrentMap<String, String>>("cdl.workspaceRootCache")
    }
}
