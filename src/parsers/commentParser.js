// @ts-check

import { DOCUMENT_LINK_REGEX } from "../utils/regex.js";

/**
 * @param {string} text
 * @param {number} offset
 */
export function parseComment(text, offset = 0) {
    const matches = [];

    for (const match of text.matchAll(DOCUMENT_LINK_REGEX)) {
        const file = match[1];
        const anchor = match[2] ?? null;

        matches.push({
            type: "documentation",
            file,
            anchor,
            start: offset + match.index,
            end: offset + match.index + match[0].length
        });
    }

    return matches;
}