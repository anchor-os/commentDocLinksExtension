package com.anchor.commentdoclinks.services

import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.parser.getLanguageIdFromExtension
import com.intellij.openapi.editor.Document
import com.intellij.openapi.vfs.VirtualFile

/**
 * Wrap an IntelliJ editor [Document] as a [DocumentLike] so the pure
 * parser/scanner/resolver core can run over it without any IntelliJ dependency
 * in the core packages. Lines are split on LF/CRLF/CR, matching `stringDocument`.
 */
fun documentLikeFromDocument(document: Document): DocumentLike {
    val lines = document.text.split("\r\n", "\r", "\n")
    return object : DocumentLike {
        override val lineCount: Int get() = lines.size
        override fun lineAt(index: Int): String = lines.getOrElse(index) { "" }
    }
}

/**
 * Best-effort VS Code-style `languageId` for a source [VirtualFile], using the
 * shared extension map. Returns null for unsupported extensions.
 */
fun languageIdFromVirtualFile(file: VirtualFile): String? =
    getLanguageIdFromExtension(file.name)
