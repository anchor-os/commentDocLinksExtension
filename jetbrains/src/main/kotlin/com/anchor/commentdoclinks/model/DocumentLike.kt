package com.anchor.commentdoclinks.model

/**
 * Minimal read-only line view over text, mirroring the parts of the VS Code
 * `TextDocument` the resolvers need (no IntelliJ dependency).
 */
interface DocumentLike {
    val lineCount: Int
    fun lineAt(index: Int): String
}

/**
 * Build a [DocumentLike] from a single text string, splitting on LF / CRLF /
 * CR (matching the VS Code line splitter `/\r\n|\r|\n/`).
 */
fun stringDocument(text: String): DocumentLike {
    val lines = text.split("\r\n", "\r", "\n")
    return object : DocumentLike {
        override val lineCount: Int get() = lines.size
        override fun lineAt(index: Int): String = lines.getOrElse(index) { "" }
    }
}
