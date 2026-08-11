// @ts-check

import {
    getCommentRanges,
    getLanguageIdFromExtension
} from "../parsers/languageSupport.js";

import { parseComment }
    from "../parsers/commentParser.js";

import { parseMarkdownHeading }
    from "../parsers/markdownParser.js";

import {
    listAnchors
} from "../services/anchorResolver.js";

import {
    hasExactSourceReference
} from "../services/sourceResolver.js";

/**
 * @typedef {object} DocumentLike
 * @property {string} languageId
 * @property {number} lineCount
 * @property {(index: number) => { text: string }} lineAt
 */

/**
 * @typedef {object} FileSystemLike
 * @property {(relativePath: string) => boolean} exists
 * @property {(relativePath: string) => string|null} readText
 */

/**
 * @typedef {object} BrokenReference
 * @property {number} line
 * @property {number} start
 * @property {number} end
 * @property {string} message
 */

export function documentFromText(text, languageId) {
    const lines = text.split(/\r\n|\r|\n/);

    return {
        languageId,
        lineCount: lines.length,
        lineAt(index) {
            return { text: lines[index] };
        }
    };
}

/**
 * Find every broken documentation/source reference in a document.
 *
 * Deliberately conservative — a reference is only reported when it can
 * be proven broken (target file missing, or the anchor is provably
 * absent). Unknown cases are skipped to avoid false positives.
 *
 * @param {DocumentLike} document
 * @param {FileSystemLike} fsLike
 * @param {string} relativeDocumentationPath
 * @returns {BrokenReference[]}
 */
export function collectBrokenReferences(
    document,
    fsLike,
    relativeDocumentationPath
) {
    if (document.languageId === "markdown") {
        return collectBrokenMarkdownReferences(
            document,
            fsLike,
            relativeDocumentationPath
        );
    }

    return collectBrokenCommentReferences(
        document,
        fsLike
    );
}

function collectBrokenCommentReferences(
    document,
    fsLike
) {
    const broken = [];

    const state = { inBlockComment: false };

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;

        const commentRanges = getCommentRanges(
            document.languageId,
            text,
            state
        );

        for (const range of commentRanges) {
            const matches = parseComment(
                text.slice(range.start, range.end),
                range.start
            );

            for (const match of matches) {
                if (!fsLike.exists(match.file)) {
                    broken.push({
                        line: i,
                        start: match.start,
                        end: match.end,
                        message:
                            `Documentation file not found: ${match.file}`
                    });

                    continue;
                }

                if (match.line !== null) {
                    const docText = fsLike.readText(match.file);

                    if (docText === null) {
                        continue;
                    }

                    const doc = documentFromText(
                        docText,
                        "markdown"
                    );

                    if (match.line < 1 || match.line > doc.lineCount) {
                        broken.push({
                            line: i,
                            start: match.start,
                            end: match.end,
                            message:
                                `Documentation line out of range: ${match.line}`
                        });
                    }

                    continue;
                }

                if (!match.anchor) {
                    continue;
                }

                const docText = fsLike.readText(match.file);

                if (docText === null) {
                    continue;
                }

                const doc = documentFromText(
                    docText,
                    "markdown"
                );

                if (!listAnchors(doc).includes(match.anchor)) {
                    broken.push({
                        line: i,
                        start: match.start,
                        end: match.end,
                        message:
                            `Documentation anchor not found: ${match.anchor}`
                    });
                }
            }
        }
    }

    return broken;
}

function collectBrokenMarkdownReferences(
    document,
    fsLike,
    relativeDocumentationPath
) {
    const broken = [];

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;

        const parsed = parseMarkdownHeading(text);

        if (!parsed) {
            continue;
        }

        if (!fsLike.exists(parsed.source)) {
            broken.push({
                line: i,
                start: parsed.start,
                end: parsed.end,
                message: `Source file not found: ${parsed.source}`
            });

            continue;
        }

        const languageId =
            getLanguageIdFromExtension(parsed.source);

        if (
            !parsed.anchor ||
            languageId === null ||
            languageId === "markdown"
        ) {
            continue;
        }

        const sourceText = fsLike.readText(parsed.source);

        if (sourceText === null) {
            continue;
        }

        const sourceDoc = documentFromText(
            sourceText,
            languageId
        );

        if (
            !hasExactSourceReference(
                sourceDoc,
                relativeDocumentationPath,
                parsed.anchor
            )
        ) {
            broken.push({
                line: i,
                start: parsed.start,
                end: parsed.end,
                message:
                    `Source anchor not found: ${parsed.anchor}`
            });
        }
    }

    return broken;
}
