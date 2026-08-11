// @ts-check

import {
    getLanguageIdFromExtension
} from "../parsers/languageSupport.js";

import { parseMarkdownHeading }
    from "../parsers/markdownParser.js";

import {
    hasExactSourceReference
} from "../services/sourceResolver.js";

import { documentFromText }
    from "../references/document.js";

import { scanDocumentForReferences }
    from "../references/documentScanner.js";

import {
    validateReference
} from "../references/resolver.js";

import {
    RESOLUTION_STATUS
} from "../references/referenceTypes.js";

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

/**
 * Find every broken reference in a document.
 *
 * Deliberately conservative — a reference is only reported when it can
 * be proven broken (target file missing, or the anchor/line is provably
 * absent). Unknown cases are skipped to avoid false positives.
 *
 * @param {DocumentLike} document
 * @param {object} context
 *   A reference context (`{ resolveTargetPath, fs }`) or a plain
 *   filesystem-like object, in which case paths are used verbatim.
 * @param {string} relativeDocumentationPath
 * @returns {BrokenReference[]}
 */
export function collectBrokenReferences(
    document,
    context,
    relativeDocumentationPath
) {
    const referenceContext = normalizeContext(context);

    if (document.languageId === "markdown") {
        return collectBrokenMarkdownReferences(
            document,
            referenceContext,
            relativeDocumentationPath
        );
    }

    return collectBrokenCommentReferences(
        document,
        referenceContext
    );
}

/**
 * @param {object} context
 */
function normalizeContext(context) {
    if (typeof context.resolveTargetPath === "function") {
        return context;
    }

    return {
        resolveTargetPath(relativePath) {
            return relativePath;
        },
        fs: context
    };
}

/**
 * @param {DocumentLike} document
 * @param {object} context
 */
function collectBrokenCommentReferences(document, context) {
    const broken = [];

    for (const { reference, line } of
        scanDocumentForReferences(document)) {
        const result = validateReference(reference, context);

        switch (result.status) {
            case RESOLUTION_STATUS.MISSING_FILE:
            case RESOLUTION_STATUS.MISSING_ANCHOR:
            case RESOLUTION_STATUS.INVALID_LINE:
            case RESOLUTION_STATUS.INVALID_PATH:
                broken.push({
                    line,
                    start: reference.start,
                    end: reference.end,
                    message: result.message
                });
                break;
        }
    }

    return broken;
}

/**
 * @param {DocumentLike} document
 * @param {object} context
 * @param {string} relativeDocumentationPath
 */
function collectBrokenMarkdownReferences(
    document,
    context,
    relativeDocumentationPath
) {
    const broken = [];

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text;

        const parsed = parseMarkdownHeading(text);

        if (!parsed) {
            continue;
        }

        const targetPath =
            context.resolveTargetPath(parsed.source);

        if (
            targetPath === null ||
            !context.fs.exists(targetPath)
        ) {
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

        const sourceText =
            context.fs.readText(targetPath);

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
