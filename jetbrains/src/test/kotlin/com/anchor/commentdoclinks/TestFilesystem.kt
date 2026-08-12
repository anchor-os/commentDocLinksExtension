package com.anchor.commentdoclinks

import com.anchor.commentdoclinks.resolver.FileSystemLike

/** In-memory [FileSystemLike] for unit tests. Paths are exact absolute strings. */
class FakeFileSystem(private val files: Map<String, String>) : FileSystemLike {
    override fun exists(targetPath: String): Boolean = files.containsKey(targetPath)
    override fun readText(targetPath: String): String? = files[targetPath]
}
