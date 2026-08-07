// @ts-check

/**
 * Central shared constants for the Comment Doc Links extension.
 *
 * No business logic lives here — only values shared across parsers,
 * providers, resolvers, diagnostics and completion.
 */

/**
 * Documentation file extension recognized in source comments.
 */
export const MARKDOWN_EXTENSION = ".md";

/**
 * All documentation extensions the extension understands.
 */
export const DOCUMENT_EXTENSIONS = [
    MARKDOWN_EXTENSION
];

/**
 * Separator between a documentation file and its anchor in source comments:
 *
 *   see documentation/claude/comments/ENC-74995.md#reconciliation-guarantee
 */
export const ANCHOR_SEPARATOR = "#";

/**
 * Canonical separator between a source file and its anchor in Markdown
 * headings:
 *
 *   ## src/util/foo.js — reconciliation-guarantee
 */
export const MARKDOWN_SOURCE_SEPARATOR = "—";

/**
 * Alternate heading separator that is tolerated when parsing existing
 * Markdown documents (`## src/util/foo.js - anchor`).
 */
export const ALTERNATE_SOURCE_SEPARATOR = "-";

/**
 * Command identifiers contributed by the extension.
 */
export const COMMANDS = {
    OPEN_DOCUMENTATION: "commentDocLinks.openDocumentation",
    OPEN_SOURCE: "commentDocLinks.openSource"
};
