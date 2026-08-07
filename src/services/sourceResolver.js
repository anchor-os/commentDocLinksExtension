// @ts-check

import { getCommentRanges } from "../parsers/languageSupport.js";
import { parseComment } from "../parsers/commentParser.js";

/**
 * @typedef {object} DocumentLike
 * @property {string} languageId
 * @property {number} lineCount
 * @property {(index: number) => { text: string }} lineAt
 */

/**
 * @typedef {object} SourceReference
 * @property {number} line
 * @property {number} character
 * @property {boolean} anchorFound
 *   True when the requested anchor was matched exactly. When false the
 *   position still points at the best available location.
 */

/**
 * Find the source comment that references a documentation file.
 *
 * Resolution rules:
 *
 * - The exact reference `documentationFile#anchor` wins.
 * - If the file is referenced without the anchor, the first such
 *   reference is returned (anchorFound: false).
 * - If nothing references the file, the top of the source document is
 *   returned (anchorFound: false).
 *
 * The source file is assumed to be open (callers resolve existence
 * separately); this resolver never returns null for a valid document.
 *
 * @param {DocumentLike} document
 * @param {string} documentationFile
 * @param {string|null} anchor
 * @returns {SourceReference}
 */
export function resolveSourceReference(
    document,
    documentationFile,
    anchor
) {
    const state = { inBlockComment: false };

    let fallback = null;

    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;

        const commentRanges = getCommentRanges(
            document.languageId,
            lineText,
            state
        );

        for (const range of commentRanges) {
            const commentText = lineText.slice(
                range.start,
                range.end
            );

            const matches = parseComment(
                commentText,
                range.start
            );

            for (const match of matches) {
                if (match.file !== documentationFile) {
                    continue;
                }

                if (anchor && match.anchor === anchor) {
                    return {
                        line,
                        character: 0,
                        anchorFound: true
                    };
                }

                if (
                    match.anchor === null &&
                    fallback === null
                ) {
                    fallback = {
                        line,
                        character: 0,
                        anchorFound: false
                    };
                }
            }
        }
    }

    if (fallback !== null) {
        return fallback;
    }

    return {
        line: 0,
        character: 0,
        anchorFound: false
    };
}

/**
 * True when the source document contains a comment that references the
 * documentation file with the exact anchor.
 *
 * @param {DocumentLike} document
 * @param {string} documentationFile
 * @param {string} anchor
 * @returns {boolean}
 */
export function hasExactSourceReference(
    document,
    documentationFile,
    anchor
) {
    if (!anchor) {
        return false;
    }

    const state = { inBlockComment: false };

    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;

        const commentRanges = getCommentRanges(
            document.languageId,
            lineText,
            state
        );

        for (const range of commentRanges) {
            const commentText = lineText.slice(
                range.start,
                range.end
            );

            const matches = parseComment(
                commentText,
                range.start
            );

            for (const match of matches) {
                if (
                    match.file === documentationFile &&
                    match.anchor === anchor
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * List every anchor referenced by comments in the source document that
 * point at the given documentation file.
 *
 * @param {DocumentLike} document
 * @param {string} documentationFile
 * @returns {string[]}
 */
export function listSourceAnchors(
    document,
    documentationFile
) {
    const anchors = new Set();

    const state = { inBlockComment: false };

    for (let line = 0; line < document.lineCount; line++) {
        const lineText = document.lineAt(line).text;

        const commentRanges = getCommentRanges(
            document.languageId,
            lineText,
            state
        );

        for (const range of commentRanges) {
            const commentText = lineText.slice(
                range.start,
                range.end
            );

            const matches = parseComment(
                commentText,
                range.start
            );

            for (const match of matches) {
                if (
                    match.file === documentationFile &&
                    match.anchor !== null
                ) {
                    anchors.add(match.anchor);
                }
            }
        }
    }

    return [...anchors];
}
