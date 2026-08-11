// @ts-check

/**
 * Languages whose comments can contain documentation references.
 *
 * Adding a language here requires:
 *  1. an entry in LANGUAGE_COMMENT_STYLE (how comments are detected), and
 *  2. optionally an entry in EXTENSION_TO_LANGUAGE (for reverse navigation
 *     from a Markdown heading back to a source file).
 */
export const SUPPORTED_LANGUAGES = new Set([
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
    "swift"
]);

/**
 * @param {string} languageId
 */
export function supportsLanguage(languageId) {
    return SUPPORTED_LANGUAGES.has(languageId);
}

/**
 * VS Code document selector for every language the extension understands.
 * Kept in one place so providers and diagnostics stay in sync.
 *
 * @returns {import("vscode").DocumentSelector}
 */
export function documentSelector() {
    return [...SUPPORTED_LANGUAGES].map((language) => ({
        language
    }));
}

/**
 * Comment syntax family used to find comment ranges in a line.
 */
const COMMENT_STYLE = {
    /** `//`, `/* *​*​/` with string awareness (C-family). */
    slash: ["javascript", "javascriptreact", "typescript",
        "typescriptreact", "java", "go", "rust", "c", "cpp",
        "csharp", "kotlin", "swift"],
    /** `#` line comments (Python, Ruby). */
    hash: ["python", "ruby"],
    /** YAML `#` comments with quoted-string and block-scalar awareness. */
    yaml: ["yaml"],
    /** Terraform `#`, `//` and `/* *​*​/` comments with heredoc awareness. */
    terraform: ["terraform"],
    /** GraphQL `#` comments with string and block-string awareness. */
    graphql: ["graphql"],
    /** `##` line comments plus `#* … *#` block comments, string-aware. */
    velocity: ["velocity"],
    /** Whole line (Markdown prose). */
    wholeLine: ["markdown"],
    /** `//`, `#` and `/* *​*​/` (PHP). */
    php: ["php"]
};

const LANGUAGE_COMMENT_STYLE = new Map();

for (const [style, languages] of Object.entries(COMMENT_STYLE)) {
    for (const language of languages) {
        LANGUAGE_COMMENT_STYLE.set(language, style);
    }
}

const EXTENSION_TO_LANGUAGE = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".jsx": "javascriptreact",
    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".tsx": "typescriptreact",
    ".gql": "graphql",
    ".graphql": "graphql",
    ".tf": "terraform",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".vm": "velocity",
    ".vtl": "velocity",
    ".md": "markdown",
    ".markdown": "markdown",
    ".py": "python",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".php": "php",
    ".rb": "ruby",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".swift": "swift"
};

/**
 * Best-effort languageId for a file path, or null when the extension is not
 * one of the supported languages.
 *
 * @param {string} filename
 * @returns {string|null}
 */
export function getLanguageIdFromExtension(filename) {
    const lower = filename.toLowerCase();
    const dot = lower.lastIndexOf(".");

    if (dot === -1) {
        return null;
    }

    return EXTENSION_TO_LANGUAGE[lower.slice(dot)] ?? null;
}

/**
 * Determine which portions of a line are comments.
 *
 * This function is stateful: pass an object carrying `inBlockComment` and
 * `inString` and reuse it across lines of the same document so block
 * comments and multiline strings opened on an earlier line are still
 * recognized. PHP additionally tracks the active region in `inPhp` and YAML
 * tracks the active block scalar in `inBlockScalar`.
 *
 * @param {string} languageId
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null, inPhp?: boolean, inBlockScalar?: number|null }} state
 * @returns {Array<{start: number, end: number}>}
 */
export function getCommentRanges(languageId, line, state) {
    switch (LANGUAGE_COMMENT_STYLE.get(languageId)) {
        case "slash":
            return getSlashCommentRanges(line, state);

        case "hash":
            return getHashCommentRanges(line, state);

        case "yaml":
            return getYamlCommentRanges(line, state);

        case "terraform":
            return getTerraformCommentRanges(line, state);

        case "graphql":
            return getGraphqlCommentRanges(line, state);

        case "velocity":
            return getVelocityCommentRanges(line, state);

        case "php":
            return getPhpCommentRanges(line, state);

        case "wholeLine":
            return [{ start: 0, end: line.length }];

        default:
            return [];
    }
}

/**
 * C-family comments: `//` line comments and `/* … *​​/` block comments.
 *
 * The scanner only recognizes comment delimiters outside strings; content
 * inside string literals is never treated as a comment. Backtick strings
 * (Go raw strings, JavaScript template literals), `"""` literals (Kotlin,
 * Swift) and C# verbatim strings (`@"…"`) may span lines; the active
 * delimiter is carried in `state.inString` to the next line.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null }} state
 */
function getSlashCommentRanges(line, state) {
    const ranges = [];

    let i = 0;
    let start = null;
    let quote = state.inString;
    let escaped = false;

    while (i < line.length) {
        const char = line[i];
        const next = line[i + 1];

        if (state.inBlockComment) {
            if (char === "*" && next === "/") {
                ranges.push({
                    start: start ?? 0,
                    end: i + 2
                });

                state.inBlockComment = false;
                start = null;
                i += 2;
                continue;
            }

            i++;
            continue;
        }

        if (quote) {
            if (quote.length === 3) {
                if (line.startsWith(quote, i)) {
                    quote = null;
                    state.inString = null;
                    i += 2;
                } else {
                    i++;
                }
                continue;
            }

            if (quote === '@"') {
                if (char === '"' && next === '"') {
                    i += 2;
                    continue;
                }

                if (char === '"') {
                    quote = null;
                    state.inString = null;
                }

                i++;
                continue;
            }

            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
                state.inString = null;
            }

            i++;
            continue;
        }

        if (line.startsWith('"""', i)) {
            quote = '"""';
            state.inString = '"""';
            i += 3;
            continue;
        }

        if (char === "@" && next === '"') {
            quote = '@"';
            state.inString = '@"';
            i += 2;
            continue;
        }

        if (
            char === "'" ||
            char === '"' ||
            char === "`"
        ) {
            quote = char;
            state.inString = char === "`" ? char : null;
            i++;
            continue;
        }

        if (char === "/" && next === "/") {
            ranges.push({
                start: i,
                end: line.length
            });

            break;
        }

        if (char === "/" && next === "*") {
            start = i;
            state.inBlockComment = true;
            i += 2;
            continue;
        }

        i++;
    }

    if (state.inBlockComment) {
        ranges.push({
            start: start ?? 0,
            end: line.length
        });
    }

    return ranges;
}

/**
 * PHP comments: `//` and `#` line comments plus `/* … *​​/` block comments.
 * `#[…]` attribute syntax is not a comment.
 *
 * Comments and strings are only recognized inside `<?php … ?>` regions.
 * The active region is tracked in `state.inPhp` (defaults to outside PHP,
 * matching a file that starts in HTML mode), so apostrophes in inline HTML
 * such as `<p>It's here</p>` never set persistent string state.
 *
 * Strings (single/double quoted and heredoc/nowdoc bodies) may span lines;
 * the active delimiter is carried in `state.inString` so `#`/`//` inside a
 * literal never starts a comment.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null, inPhp?: boolean }} state
 */
function getPhpCommentRanges(line, state) {
    const ranges = [];

    if (state.inPhp === undefined) {
        state.inPhp = false;
    }

    let i = 0;
    let start = null;
    let quote = state.inString;
    let escaped = false;

    while (i < line.length) {
        const char = line[i];
        const next = line[i + 1];

        if (state.inBlockComment) {
            if (char === "*" && next === "/") {
                ranges.push({
                    start: start ?? 0,
                    end: i + 2
                });

                state.inBlockComment = false;
                start = null;
                i += 2;
                continue;
            }

            i++;
            continue;
        }

        if (quote) {
            if (quote.startsWith("heredoc:")) {
                const terminator = quote.slice("heredoc:".length);
                const end = heredocTerminatorEnd(line, terminator);

                if (end === -1) {
                    return ranges;
                }

                quote = null;
                state.inString = null;
                i = end;
                continue;
            }

            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
                state.inString = null;
            }

            i++;
            continue;
        }

        if (!state.inPhp) {
            if (char === "<" && next === "?") {
                state.inPhp = true;
                i += 2;
                continue;
            }

            i++;
            continue;
        }

        if (char === "?" && next === ">") {
            state.inPhp = false;
            i += 2;
            continue;
        }

        if (
            char === "<" &&
            next === "<" &&
            line[i + 2] === "<"
        ) {
            const label = line
                .slice(i + 3)
                .match(/^[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);

            if (label) {
                state.inString = `heredoc:${label[2]}`;
                return ranges;
            }

            i++;
            continue;
        }

        if (char === "'" || char === '"') {
            quote = char;
            state.inString = char;
            i++;
            continue;
        }

        if (char === "/" && next === "/") {
            ranges.push({
                start: i,
                end: line.length
            });

            break;
        }

        if (char === "#") {
            if (next === "[") {
                i++;
                continue;
            }

            ranges.push({
                start: i,
                end: line.length
            });

            break;
        }

        if (char === "/" && next === "*") {
            start = i;
            state.inBlockComment = true;
            i += 2;
            continue;
        }

        i++;
    }

    if (state.inBlockComment) {
        ranges.push({
            start: start ?? 0,
            end: line.length
        });
    }

    return ranges;
}

/**
 * End offset of the heredoc/nowdoc closing marker on `line`, or -1 when the
 * line is heredoc body rather than the closer.
 *
 * PHP 7.3+ allows the marker to be followed by `;`, `,` or `)` (e.g. `EOT)`
 * or `EOT,`) and other code; a plain prefix check with a word-boundary guard
 * covers every form.
 *
 * @param {string} line
 * @param {string} terminator
 * @returns {number}
 */
function heredocTerminatorEnd(line, terminator) {
    const trimmed = line.trim();

    if (!trimmed.startsWith(terminator)) {
        return -1;
    }

    const rest = trimmed.slice(terminator.length);

    if (/^[A-Za-z0-9_]/.test(rest)) {
        return -1;
    }

    return (
        line.length - line.trimStart().length +
        terminator.length
    );
}

/**
 * `#` line comments (Python, Ruby, GraphQL, Terraform, YAML).
 *
 * The scanner only treats `#` as a comment outside strings. Python
 * triple-quoted strings may span lines; an unclosed triple quote is carried
 * in `state.inString` to the next line so `#` inside the literal never
 * starts a comment.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null }} state
 */
function getHashCommentRanges(line, state) {
    let quote = state.inString;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (quote) {
            if (quote.length === 3) {
                if (line.startsWith(quote, i)) {
                    quote = null;
                    state.inString = null;
                    i += 2;
                }
            } else if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (char === '"' && line.startsWith('"""', i)) {
            quote = '"""';
            state.inString = '"""';
            i += 2;
            continue;
        }

        if (char === "'" && line.startsWith("'''", i)) {
            quote = "'''";
            state.inString = "'''";
            i += 2;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            state.inString = null;
            continue;
        }

        if (char === "#") {
            return [{
                start: i,
                end: line.length
            }];
        }
    }

    return [];
}

/**
 * YAML `#` comments.
 *
 * A `#` only starts a comment at the start of a line or when preceded by
 * white space (per the YAML spec), so `value#123` stays part of a plain
 * scalar. Single and double quoted strings are skipped (single-quoted
 * strings escape `'` by doubling it), and block scalar headers
 * (`description: |`, `description: >`) open a state in which every
 * following line indented deeper than the header is literal content that is
 * never scanned for comments.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null, inBlockScalar?: number|null }} state
 */
function getYamlCommentRanges(line, state) {
    if (state.inBlockScalar === undefined) {
        state.inBlockScalar = null;
    }

    if (state.inBlockScalar !== null) {
        const indent = leadingWhitespace(line);

        if (indent > state.inBlockScalar || line.trim() === "") {
            return [];
        }

        state.inBlockScalar = null;
    }

    if (state.inBlockScalar === null) {
        state.inBlockScalar = yamlBlockScalarHeaderIndent(line);
    }

    let quote = state.inString;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (quote) {
            if (
                quote === "'" &&
                char === "'" &&
                line[i + 1] === "'"
            ) {
                i++;
                continue;
            }

            if (escaped) {
                escaped = false;
            } else if (char === "\\" && quote === '"') {
                escaped = true;
            } else if (char === quote) {
                quote = null;
                state.inString = null;
            }

            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            state.inString = null;
            continue;
        }

        if (
            char === "#" &&
            (i === 0 || /[ \t]/.test(line[i - 1]))
        ) {
            return [{
                start: i,
                end: line.length
            }];
        }
    }

    return [];
}

/**
 * Length in columns of the leading white space on `line`.
 *
 * @param {string} line
 * @returns {number}
 */
function leadingWhitespace(line) {
    return line.match(/^[ \t]*/)[0].length;
}

/**
 * Indentation of a YAML block scalar header line (`description: |`), or
 * null when the line does not open a block scalar.
 *
 * Handles chomping and indentation indicators (`|+`, `>2-`), a trailing `#`
 * comment and sequence items that are themselves block scalars (`- |`).
 * Quoted content is skipped so `"key: |"` never looks like a header and
 * URLs such as `https://…` are not misread as key separators.
 *
 * @param {string} line
 * @returns {number|null}
 */
function yamlBlockScalarHeaderIndent(line) {
    let quote = null;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (quote) {
            if (
                quote === "'" &&
                char === "'" &&
                line[i + 1] === "'"
            ) {
                i++;
                continue;
            }

            if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }

        if (char === "#") {
            break;
        }

        const opensScalar =
            char === ":" &&
            yamlBlockScalarValue(line, i + 1) !== -1;

        const opensSequenceScalar =
            char === "-" &&
            (i === 0 || /[ \t]/.test(line[i - 1])) &&
            /[ \t]/.test(line[i + 1] ?? "") &&
            yamlBlockScalarValue(line, i + 1) !== -1;

        if (opensScalar || opensSequenceScalar) {
            return leadingWhitespace(line);
        }
    }

    return null;
}

/**
 * Whether the text after a YAML key/value separator (`:` or sequence `-`)
 * is a block scalar header indicator (`|` or `>` with optional chomping/
 * indentation suffix), followed by nothing but white space or a comment.
 *
 * @param {string} line
 * @param {number} index Position just past the separator.
 * @returns {number} The index after a valid indicator, or -1.
 */
function yamlBlockScalarValue(line, index) {
    let j = index;

    while (line[j] === " " || line[j] === "\t") {
        j++;
    }

    if (line[j] !== "|" && line[j] !== ">") {
        return -1;
    }

    let k = j + 1;

    while (
        line[k] === "+" ||
        line[k] === "-" ||
        (line[k] >= "1" && line[k] <= "9")
    ) {
        k++;
    }

    const rest = line.slice(k).trim();

    if (rest !== "" && !rest.startsWith("#")) {
        return -1;
    }

    return k;
}

/**
 * Terraform (HCL) comments: `#` and `//` line comments plus `/* … *​​/`
 * block comments, with string and heredoc awareness.
 *
 * String literals (`"…"`) and heredocs (`<<EOT`, `<<-EOT`, `<<"EOT"`,
 * `<<'EOT'`) are skipped, so `description = "#123"` and text inside a
 * heredoc never produce a comment. Heredoc bodies may span lines; the
 * active delimiter is carried in `state.inString`.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null }} state
 */
function getTerraformCommentRanges(line, state) {
    const ranges = [];

    let i = 0;
    let start = null;
    let quote = state.inString;
    let escaped = false;

    while (i < line.length) {
        const char = line[i];
        const next = line[i + 1];

        if (state.inBlockComment) {
            if (char === "*" && next === "/") {
                ranges.push({
                    start: start ?? 0,
                    end: i + 2
                });

                state.inBlockComment = false;
                start = null;
                i += 2;
                continue;
            }

            i++;
            continue;
        }

        if (quote) {
            if (quote.startsWith("heredoc:")) {
                const terminator = quote.slice("heredoc:".length);
                const trimmed = line.trim();

                if (
                    !trimmed.startsWith(terminator) ||
                    (trimmed.length > terminator.length &&
                        !/^\s/.test(trimmed.slice(terminator.length)))
                ) {
                    return ranges;
                }

                quote = null;
                state.inString = null;
                return ranges;
            }

            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
                state.inString = null;
            }

            i++;
            continue;
        }

        if (
            char === "<" &&
            next === "<" &&
            (i === 0 || /[\s=([,]/.test(line[i - 1]))
        ) {
            let j = i + 2;

            if (line[j] === "-") {
                j++;
            }

            const label = line
                .slice(j)
                .match(/^[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);

            if (label) {
                state.inString = `heredoc:${label[2]}`;
                return ranges;
            }

            i++;
            continue;
        }

        if (char === '"') {
            quote = char;
            state.inString = char;
            i++;
            continue;
        }

        if (char === "#" || (char === "/" && next === "/")) {
            ranges.push({
                start: i,
                end: line.length
            });

            break;
        }

        if (char === "/" && next === "*") {
            start = i;
            state.inBlockComment = true;
            i += 2;
            continue;
        }

        i++;
    }

    if (state.inBlockComment) {
        ranges.push({
            start: start ?? 0,
            end: line.length
        });
    }

    return ranges;
}

/**
 * GraphQL `#` comments with string awareness.
 *
 * GraphQL strings (`"…"`) are single-line; block strings (`"""…"""`) may
 * span lines and support the `\"""` escape. A `#` inside either is never a
 * comment.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null }} state
 */
function getGraphqlCommentRanges(line, state) {
    let quote = state.inString;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (quote) {
            if (quote === '"""') {
                if (line.startsWith('\\"""', i)) {
                    i += 3;
                    continue;
                }

                if (line.startsWith('"""', i)) {
                    quote = null;
                    state.inString = null;
                    i += 2;
                }

                continue;
            }

            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
                state.inString = null;
            }

            continue;
        }

        if (line.startsWith('"""', i)) {
            quote = '"""';
            state.inString = '"""';
            i += 2;
            continue;
        }

        if (char === '"') {
            quote = '"';
            state.inString = null;
            continue;
        }

        if (char === "#") {
            return [{
                start: i,
                end: line.length
            }];
        }
    }

    return [];
}

/**
 * Velocity:
 *
 *   ## comment
 *   #* multiline comment *#
 *
 * A single `#` starts a directive (`#if`, `#set`, `#foreach`, …) and is
 * never a comment. String literals (`"…"`, `'…'`) are skipped so `##` or
 * `#*` inside a string is literal text, and `##` comments may start
 * anywhere on the line (not just at column zero).
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean, inString: string|null }} state
 */
function getVelocityCommentRanges(line, state) {
    const ranges = [];

    let i = 0;
    let start = null;
    let quote = state.inString;
    let escaped = false;

    while (i < line.length) {
        const char = line[i];
        const next = line[i + 1];

        if (state.inBlockComment) {
            if (char === "*" && next === "#") {
                ranges.push({
                    start: start ?? 0,
                    end: i + 2
                });

                state.inBlockComment = false;
                start = null;
                i += 2;
                continue;
            }

            i++;
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
                state.inString = null;
            }

            i++;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            state.inString = char;
            i++;
            continue;
        }

        if (char === "#" && next === "*") {
            start = i;
            state.inBlockComment = true;
            i += 2;
            continue;
        }

        if (char === "#" && next === "#") {
            ranges.push({
                start: i,
                end: line.length
            });

            break;
        }

        i++;
    }

    if (state.inBlockComment) {
        ranges.push({
            start: start ?? 0,
            end: line.length
        });
    }

    return ranges;
}
