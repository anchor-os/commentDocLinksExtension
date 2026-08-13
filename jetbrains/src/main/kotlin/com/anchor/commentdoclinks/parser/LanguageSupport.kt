package com.anchor.commentdoclinks.parser

/**
 * Mutable scanner state carried across lines of one document so block
 * comments and multiline strings opened earlier stay recognized.
 */
class CommentScannerState(
    var inBlockComment: Boolean = false,
    var inString: String? = null,
    var inPhp: Boolean? = null,
    var inBlockScalar: Int? = null,
)

/**
 * A comment range within a single line. [start] is inclusive, [end] exclusive
 * (matches the VS Code `slice(start, end)` semantics used by the scanner).
 */
data class CommentRange(
    val start: Int,
    val end: Int,
)

val SUPPORTED_LANGUAGES: Set<String> =
    setOf(
        "javascript",
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "graphql",
        "terraform",
        "yaml",
        "velocity",
        "markdown",
        "python",
        "java",
        "go",
        "rust",
        "c",
        "cpp",
        "csharp",
        "php",
        "ruby",
        "kotlin",
        "swift",
    )

fun supportsLanguage(languageId: String): Boolean = SUPPORTED_LANGUAGES.contains(languageId)

private val COMMENT_STYLE: Map<String, String> =
    buildMap {
        val slash =
            listOf(
                "javascript",
                "javascriptreact",
                "typescript",
                "typescriptreact",
                "java",
                "go",
                "rust",
                "c",
                "cpp",
                "csharp",
                "kotlin",
                "swift",
            )
        val hash = listOf("python", "ruby")
        val yaml = listOf("yaml")
        val terraform = listOf("terraform")
        val graphql = listOf("graphql")
        val velocity = listOf("velocity")
        val wholeLine = listOf("markdown")
        val php = listOf("php")
        for (l in slash) put(l, "slash")
        for (l in hash) put(l, "hash")
        for (l in yaml) put(l, "yaml")
        for (l in terraform) put(l, "terraform")
        for (l in graphql) put(l, "graphql")
        for (l in velocity) put(l, "velocity")
        for (l in wholeLine) put(l, "wholeLine")
        for (l in php) put(l, "php")
    }

val EXTENSION_TO_LANGUAGE: Map<String, String> =
    mapOf(
        ".js" to "javascript",
        ".mjs" to "javascript",
        ".cjs" to "javascript",
        ".jsx" to "javascriptreact",
        ".ts" to "typescript",
        ".mts" to "typescript",
        ".cts" to "typescript",
        ".tsx" to "typescriptreact",
        ".gql" to "graphql",
        ".graphql" to "graphql",
        ".tf" to "terraform",
        ".yaml" to "yaml",
        ".yml" to "yaml",
        ".vm" to "velocity",
        ".vtl" to "velocity",
        ".md" to "markdown",
        ".markdown" to "markdown",
        ".py" to "python",
        ".java" to "java",
        ".go" to "go",
        ".rs" to "rust",
        ".c" to "c",
        ".h" to "c",
        ".cpp" to "cpp",
        ".cc" to "cpp",
        ".cxx" to "cpp",
        ".hpp" to "cpp",
        ".cs" to "csharp",
        ".php" to "php",
        ".rb" to "ruby",
        ".kt" to "kotlin",
        ".kts" to "kotlin",
        ".swift" to "swift",
    )

/**
 * Best-effort languageId for a file path, or null when the extension is not
 * one of the supported languages.
 */
fun getLanguageIdFromExtension(filename: String): String? {
    val lower = filename.lowercase()
    val dot = lower.lastIndexOf('.')
    if (dot == -1) return null
    return EXTENSION_TO_LANGUAGE[lower.substring(dot)]
}

/**
 * Determine which portions of a line are comments, given the language and the
 * carried scanner [state]. Stateful: reuse the same [CommentScannerState]
 * across lines of one document.
 */
fun getCommentRanges(
    languageId: String,
    line: String,
    state: CommentScannerState,
): List<CommentRange> =
    when (COMMENT_STYLE[languageId]) {
        "slash" -> getSlashCommentRanges(line, state)
        "hash" -> getHashCommentRanges(line, state)
        "yaml" -> getYamlCommentRanges(line, state)
        "terraform" -> getTerraformCommentRanges(line, state)
        "graphql" -> getGraphqlCommentRanges(line, state)
        "velocity" -> getVelocityCommentRanges(line, state)
        "php" -> getPhpCommentRanges(line, state)
        "wholeLine" -> listOf(CommentRange(0, line.length))
        else -> emptyList()
    }

private fun getSlashCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    val ranges = mutableListOf<CommentRange>()
    var i = 0
    var start: Int? = null
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]
        val next = if (i + 1 < line.length) line[i + 1] else '\u0000'

        if (state.inBlockComment) {
            if (char == '*' && next == '/') {
                ranges.add(CommentRange(start ?: 0, i + 2))
                state.inBlockComment = false
                start = null
                i += 2
                continue
            }
            i++
            continue
        }

        if (quote != null) {
            if (quote.length == 3) {
                if (line.startsWith(quote, i)) {
                    quote = null
                    state.inString = null
                    i += 2
                } else {
                    i++
                }
                continue
            }
            if (quote == "@\"") {
                if (char == '"' && next == '"') {
                    i += 2
                    continue
                }
                if (char == '"') {
                    quote = null
                    state.inString = null
                }
                i++
                continue
            }
            if (escaped) {
                escaped = false
            } else if (char == '\\') {
                escaped = true
            } else if (char == quote[0]) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }

        if (line.startsWith("\"\"\"", i)) {
            quote = "\"\"\""
            state.inString = "\"\"\""
            i += 3
            continue
        }
        if (char == '@' && next == '"') {
            quote = "@\""
            state.inString = "@\""
            i += 2
            continue
        }
        if (char == '\'' || char == '"' || char == '`') {
            quote = char.toString()
            state.inString = if (char == '`') char.toString() else null
            i++
            continue
        }
        if (char == '/' && next == '/') {
            ranges.add(CommentRange(i, line.length))
            break
        }
        if (char == '/' && next == '*') {
            start = i
            state.inBlockComment = true
            i += 2
            continue
        }
        i++
    }

    if (state.inBlockComment) ranges.add(CommentRange(start ?: 0, line.length))
    return ranges
}

private fun getHashCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    var i = 0
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]

        if (quote != null) {
            if (quote.length == 3) {
                if (line.startsWith(quote, i)) {
                    quote = null
                    state.inString = null
                    i += 2
                }
            } else if (escaped) {
                escaped = false
            } else if (char == '\\') {
                escaped = true
            } else if (char == quote[0]) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }

        if (char == '"' && line.startsWith("\"\"\"", i)) {
            quote = "\"\"\""
            state.inString = "\"\"\""
            i += 2
            continue
        }
        if (char == '\'' && line.startsWith("'''", i)) {
            quote = "'''"
            state.inString = "'''"
            i += 2
            continue
        }
        if (char == '"' || char == '\'') {
            quote = char.toString()
            state.inString = null
            i++
            continue
        }
        if (char == '#') {
            return listOf(CommentRange(i, line.length))
        }
        i++
    }

    return emptyList()
}

private fun getGraphqlCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    var i = 0
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]

        if (quote != null) {
            if (quote == "\"\"\"") {
                if (line.startsWith("\\\"\"\"", i)) {
                    i += 3
                    continue
                }
                if (line.startsWith("\"\"\"", i)) {
                    quote = null
                    state.inString = null
                    i += 2
                }
                i++
                continue
            }
            if (escaped) {
                escaped = false
            } else if (char == '\\') {
                escaped = true
            } else if (char == quote[0]) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }

        if (line.startsWith("\"\"\"", i)) {
            quote = "\"\"\""
            state.inString = "\"\"\""
            i += 2
            continue
        }
        if (char == '"') {
            quote = "\""
            state.inString = null
            i++
            continue
        }
        if (char == '#') {
            return listOf(CommentRange(i, line.length))
        }
        i++
    }

    return emptyList()
}

private fun leadingWhitespace(line: String): Int = line.takeWhile { it == ' ' || it == '\t' }.length

private fun yamlBlockScalarValue(
    line: String,
    index: Int,
): Int {
    var j = index
    while (j < line.length && (line[j] == ' ' || line[j] == '\t')) j++
    if (j >= line.length || (line[j] != '|' && line[j] != '>')) return -1
    var k = j + 1
    while (k < line.length && (line[k] == '+' || line[k] == '-' || (line[k] >= '1' && line[k] <= '9'))) k++
    val rest = line.substring(k).trim()
    if (rest != "" && !rest.startsWith("#")) return -1
    return k
}

private fun yamlBlockScalarHeaderIndent(line: String): Int? {
    var quote: Char? = null
    var i = 0
    while (i < line.length) {
        val char = line[i]
        if (quote != null) {
            if (quote == '\'' && char == '\'' && i + 1 < line.length && line[i + 1] == '\'') {
                i++
                i++
                continue
            }
            if (char == quote) quote = null
            i++
            continue
        }
        if (char == '"' || char == '\'') {
            quote = char
            continue
        }
        if (char == '#') break
        val opensScalar = char == ':' && yamlBlockScalarValue(line, i + 1) != -1
        val prevWs = i == 0 || line[i - 1] == ' ' || line[i - 1] == '\t'
        val opensSeq =
            char == '-' && prevWs &&
                (i + 1 < line.length && (line[i + 1] == ' ' || line[i + 1] == '\t')) &&
                yamlBlockScalarValue(line, i + 1) != -1
        if (opensScalar || opensSeq) return leadingWhitespace(line)
        i++
    }
    return null
}

private fun getYamlCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    if (state.inBlockScalar == null) state.inBlockScalar = null

    if (state.inBlockScalar != null) {
        val indent = leadingWhitespace(line)
        if (indent > state.inBlockScalar!! || line.trim() == "") {
            return emptyList()
        }
        state.inBlockScalar = null
    }

    if (state.inBlockScalar == null) {
        state.inBlockScalar = yamlBlockScalarHeaderIndent(line)
    }

    var i = 0
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]
        if (quote != null) {
            if (quote == "'" && char == '\'' && i + 1 < line.length && line[i + 1] == '\'') {
                i++
                i++
                continue
            }
            if (escaped) {
                escaped = false
            } else if (char == '\\' && quote == "\"") {
                escaped = true
            } else if (char.toString() == quote) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }
        if (char == '"' || char == '\'') {
            quote = char.toString()
            state.inString = null
            i++
            continue
        }
        if (char == '#' && (i == 0 || line[i - 1] == ' ' || line[i - 1] == '\t')) {
            return listOf(CommentRange(i, line.length))
        }
        i++
    }

    return emptyList()
}

private fun heredocTerminatorEnd(
    line: String,
    terminator: String,
): Int {
    val trimmed = line.trim()
    if (!trimmed.startsWith(terminator)) return -1
    val rest = trimmed.substring(terminator.length)
    if ((rest.isNotEmpty() && rest[0].isLetterOrDigit()) || (rest.isNotEmpty() && rest[0] == '_')) return -1
    return line.length - line.trimStart().length + terminator.length
}

private fun getTerraformCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    val ranges = mutableListOf<CommentRange>()
    var i = 0
    var start: Int? = null
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]
        val next = if (i + 1 < line.length) line[i + 1] else '\u0000'

        if (state.inBlockComment) {
            if (char == '*' && next == '/') {
                ranges.add(CommentRange(start ?: 0, i + 2))
                state.inBlockComment = false
                start = null
                i += 2
                continue
            }
            i++
            continue
        }

        if (quote != null) {
            if (quote.startsWith("heredoc:")) {
                val terminator = quote.substring("heredoc:".length)
                val trimmed = line.trim()
                if (!trimmed.startsWith(terminator) ||
                    (
                        trimmed.length > terminator.length &&
                            !trimmed.substring(terminator.length).first().isWhitespace()
                    )
                ) {
                    return ranges
                }
                quote = null
                state.inString = null
                return ranges
            }
            if (escaped) {
                escaped = false
            } else if (char == '\\') {
                escaped = true
            } else if (char == quote[0]) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }

        if (char == '<' && next == '<' &&
            (i == 0 || line[i - 1].isWhitespace() || line[i - 1] == '=' || line[i - 1] == '(' || line[i - 1] == '[' || line[i - 1] == ',')
        ) {
            var j = i + 2
            if (j < line.length && line[j] == '-') j++
            val labelMatch = Regex("""^[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1""").find(line.substring(j))
            if (labelMatch != null) {
                state.inString = "heredoc:${labelMatch.groupValues[2]}"
                return ranges
            }
            i++
            continue
        }

        if (char == '"') {
            quote = "\""
            state.inString = null
            i++
            continue
        }
        if (char == '#' || (char == '/' && next == '/')) {
            ranges.add(CommentRange(i, line.length))
            break
        }
        if (char == '/' && next == '*') {
            start = i
            state.inBlockComment = true
            i += 2
            continue
        }
        i++
    }

    if (state.inBlockComment) ranges.add(CommentRange(start ?: 0, line.length))
    return ranges
}

private fun getVelocityCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    val ranges = mutableListOf<CommentRange>()
    var i = 0
    var start: Int? = null
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]
        val next = if (i + 1 < line.length) line[i + 1] else '\u0000'

        if (state.inBlockComment) {
            if (char == '*' && next == '#') {
                ranges.add(CommentRange(start ?: 0, i + 2))
                state.inBlockComment = false
                start = null
                i += 2
                continue
            }
            i++
            continue
        }

        if (quote != null) {
            if (escaped) {
                escaped = false
            } else if (char == '\\') {
                escaped = true
            } else if (char == quote[0]) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }

        if (char == '"' || char == '\'') {
            quote = char.toString()
            state.inString = null
            i++
            continue
        }
        if (char == '#' && next == '*') {
            start = i
            state.inBlockComment = true
            i += 2
            continue
        }
        if (char == '#' && next == '#') {
            ranges.add(CommentRange(i, line.length))
            break
        }
        i++
    }

    if (state.inBlockComment) ranges.add(CommentRange(start ?: 0, line.length))
    return ranges
}

private fun getPhpCommentRanges(
    line: String,
    state: CommentScannerState,
): List<CommentRange> {
    if (state.inPhp == null) state.inPhp = false
    val ranges = mutableListOf<CommentRange>()
    var i = 0
    var start: Int? = null
    var quote = state.inString
    var escaped = false

    while (i < line.length) {
        val char = line[i]
        val next = if (i + 1 < line.length) line[i + 1] else '\u0000'

        if (state.inBlockComment) {
            if (char == '*' && next == '/') {
                ranges.add(CommentRange(start ?: 0, i + 2))
                state.inBlockComment = false
                start = null
                i += 2
                continue
            }
            i++
            continue
        }

        if (quote != null) {
            if (quote.startsWith("heredoc:")) {
                val terminator = quote.substring("heredoc:".length)
                val end = heredocTerminatorEnd(line, terminator)
                if (end == -1) return ranges
                quote = null
                state.inString = null
                i = end
                continue
            }
            if (escaped) {
                escaped = false
            } else if (char == '\\') {
                escaped = true
            } else if (char == quote[0]) {
                quote = null
                state.inString = null
            }
            i++
            continue
        }

        if (!state.inPhp!!) {
            if (char == '<' && next == '?') {
                state.inPhp = true
                i += 2
                continue
            }
            i++
            continue
        }

        if (char == '?' && next == '>') {
            state.inPhp = false
            i += 2
            continue
        }

        if (char == '<' && next == '<' && i + 2 < line.length && line[i + 2] == '<') {
            val labelMatch = Regex("""^[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1""").find(line.substring(i + 3))
            if (labelMatch != null) {
                state.inString = "heredoc:${labelMatch.groupValues[2]}"
                return ranges
            }
            i++
            continue
        }

        if (char == '\'' || char == '"') {
            quote = char.toString()
            state.inString = char.toString()
            i++
            continue
        }
        if (char == '/' && next == '/') {
            ranges.add(CommentRange(i, line.length))
            break
        }
        if (char == '#') {
            if (next == '[') {
                i++
                continue
            }
            ranges.add(CommentRange(i, line.length))
            break
        }
        if (char == '/' && next == '*') {
            start = i
            state.inBlockComment = true
            i += 2
            continue
        }
        i++
    }

    if (state.inBlockComment) ranges.add(CommentRange(start ?: 0, line.length))
    return ranges
}
