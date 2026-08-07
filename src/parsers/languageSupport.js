// @ts-check

/**
 * Languages whose comments can contain documentation links.
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
    "markdown"
]);

/**
 * @param {string} languageId
 */
export function supportsLanguage(languageId) {
    return SUPPORTED_LANGUAGES.has(languageId);
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
    ".markdown": "markdown"
};

/**
 * Best-effort languageId for a file path, or null when the extension
 * is not one of the supported languages.
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
 * This function is stateful for block comments.
 *
 * @param {string} languageId
 * @param {string} line
 * @param {{ inBlockComment: boolean }} state
 * @returns {Array<{start: number, end: number}>}
 */
export function getCommentRanges(languageId, line, state) {
    switch (languageId) {
        case "javascript":
        case "javascriptreact":
        case "typescript":
        case "typescriptreact":
            return getSlashCommentRanges(line, state);

        case "graphql":
        case "terraform":
        case "yaml":
            return getHashCommentRanges(line);

        case "velocity":
            return getVelocityCommentRanges(line, state);

        case "markdown":
            return [{ start: 0, end: line.length }];

        default:
            return [];
    }
}

/**
 * JavaScript / TypeScript:
 *
 * // comment
 * /* comment *\/
 *
 * This intentionally does NOT try to fully parse JavaScript strings.
 * The scanner only recognizes comment delimiters outside strings.
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean }} state
 */
function getSlashCommentRanges(line, state) {
    const ranges = [];

    let i = 0;
    let start = null;
    let quote = null;
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
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }

            i++;
            continue;
        }

        if (
            char === "'" ||
            char === '"' ||
            char === "`"
        ) {
            quote = char;
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
 * # comment
 *
 * @param {string} line
 */
function getHashCommentRanges(line) {
    let quote = null;
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (quote) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === quote) {
                quote = null;
            }

            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
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
 * ## comment
 * #* multiline comment *#
 *
 * @param {string} line
 * @param {{ inBlockComment: boolean }} state
 */
function getVelocityCommentRanges(line, state) {
    const ranges = [];

    if (state.inBlockComment) {
        const end = line.indexOf("*#");

        if (end === -1) {
            ranges.push({
                start: 0,
                end: line.length
            });

            return ranges;
        }

        ranges.push({
            start: 0,
            end: end + 2
        });

        state.inBlockComment = false;

        return ranges;
    }

    const blockStart = line.indexOf("#*");

    if (blockStart !== -1) {
        const blockEnd = line.indexOf("*#", blockStart + 2);

        if (blockEnd === -1) {
            ranges.push({
                start: blockStart,
                end: line.length
            });

            state.inBlockComment = true;
            return ranges;
        }

        ranges.push({
            start: blockStart,
            end: blockEnd + 2
        });

        return ranges;
    }

    const lineStart = line.trimStart();

    if (lineStart.startsWith("##")) {
        const start = line.indexOf("##");

        return [{
            start,
            end: line.length
        }];
    }

    return [];
}