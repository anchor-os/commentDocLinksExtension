// @ts-check

import { parseMarkdownHeading } from "../parsers/markdownParser.js";

/**
 * @typedef {object} DocumentLike
 * @property {string} languageId
 * @property {number} lineCount
 * @property {(index: number) => { text: string }} lineAt
 */

/**
 * @typedef {object} Location
 * @property {number} line
 * @property {number} character
 */

/**
 * Locate an anchor inside a Markdown document.
 *
 * Two anchor representations are supported:
 *
 * 1. Documentation headings:
 *
 *    ## src/util/foo.js — reconciliation-guarantee
 *
 * 2. HTML anchors:
 *
 *    <a id="reconciliation-guarantee"></a>
 *
 * Matching is exact — `foo` never resolves to `foo-bar`.
 *
 * @param {DocumentLike} document
 * @param {string} anchor
 * @returns {Location|null}
 */
export function resolveAnchor(document, anchor) {
    if (!anchor) {
        return null;
    }

    for (let i = 0; i < document.lineCount; i++) {
        const parsed =
            parseMarkdownHeading(document.lineAt(i).text);

        if (parsed && parsed.anchor === anchor) {
            return { line: i, character: 0 };
        }
    }

    const htmlTarget = `<a id="${anchor}"></a>`;

    for (let i = 0; i < document.lineCount; i++) {
        if (document.lineAt(i).text.includes(htmlTarget)) {
            return { line: i, character: 0 };
        }
    }

    return null;
}

/**
 * List every anchor defined in a Markdown document.
 *
 * Used by completion to suggest available anchors.
 *
 * @param {DocumentLike} document
 * @returns {string[]}
 */
export function listAnchors(document) {
    const anchors = new Set();

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;

        const parsed = parseMarkdownHeading(text);

        if (parsed) {
            anchors.add(parsed.anchor);
        }

        const htmlMatch = text.match(/<a id="([A-Za-z0-9_-]+)"><\/a>/);

        if (htmlMatch) {
            anchors.add(htmlMatch[1]);
        }
    }

    return [...anchors];
}
