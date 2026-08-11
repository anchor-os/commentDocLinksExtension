// @ts-check

import {
    MARKDOWN_EXTENSION,
    ANCHOR_SEPARATOR,
    MARKDOWN_SOURCE_SEPARATOR,
    ALTERNATE_SOURCE_SEPARATOR
} from "../constants.js";

const escapedExtension =
    MARKDOWN_EXTENSION.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches documentation references inside comments:
 *
 *   documentation/file.md
 *   documentation/file.md#anchor
 *   documentation/file.md - anchor
 *   documentation/file.md — anchor
 *   documentation/file.md:42
 *   documentation/file.md#L42
 */
export const DOCUMENT_LINK_REGEX = new RegExp(
    `([A-Za-z0-9_./-]+${escapedExtension})` +
    `(?:(?::(\\d+))|` +
    `(?:${ANCHOR_SEPARATOR}[Ll](\\d+))|` +
    `(?:${ANCHOR_SEPARATOR}|\\s+${ALTERNATE_SOURCE_SEPARATOR}\\s+|\\s+${MARKDOWN_SOURCE_SEPARATOR}\\s+)` +
    `([A-Za-z0-9_-]+))?`,
    "g"
);
