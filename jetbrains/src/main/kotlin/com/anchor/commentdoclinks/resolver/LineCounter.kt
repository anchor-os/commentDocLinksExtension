package com.anchor.commentdoclinks.resolver

/**
 * Count lines the way VS Code does: split text on `/\r\n|\r|\n/` and return
 * the number of resulting segments. CRLF and bare-CR files behave like LF.
 */
fun countLines(text: String): Int = if (text.isEmpty()) 1 else text.split("\r\n", "\r", "\n").size
