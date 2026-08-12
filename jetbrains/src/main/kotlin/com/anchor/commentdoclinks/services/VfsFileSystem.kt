package com.anchor.commentdoclinks.services

import com.anchor.commentdoclinks.resolver.FileSystemLike
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile

/**
 * [FileSystemLike] backed by the IntelliJ local file system (VFS).
 *
 * [targetPath] is an absolute, root-resolved path produced by the pure
 * `resolveInRoot`. The VFS is consulted so that in-memory/edited content is
 * seen; when the VFS has not loaded the file yet it is treated as absent
 * (validation then reports "missing file" rather than guessing).
 */
class VfsFileSystem : FileSystemLike {
    override fun exists(targetPath: String): Boolean {
        return LocalFileSystem.getInstance().findFileByPath(targetPath) != null
    }

    override fun readText(targetPath: String): String? {
        val file: VirtualFile =
            LocalFileSystem.getInstance().findFileByPath(targetPath) ?: return null
        return try {
            String(file.contentsToByteArray())
        } catch (_: Exception) {
            null
        }
    }
}
