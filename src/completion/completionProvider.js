// @ts-check

import * as vscode from "vscode";
import fs from "node:fs";

import {
    getCommentRanges,
    getLanguageIdFromExtension
} from "../parsers/languageSupport.js";

import {
    listAnchors
} from "../services/anchorResolver.js";

import {
    listSourceAnchors
} from "../services/sourceResolver.js";

import {
    documentFromText
} from "../diagnostics/brokenReferenceScanner.js";

import {
    extractDocFileAfterHash,
    extractHeadingSourceBeforeDash,
    anchorSuffixRange
} from "./suggestions.js";

import {
    resolveWorkspacePath
} from "../services/workspace.js";

/**
 * @param {string} text
 * @returns {vscode.CompletionItem}
 */
function anchorCompletionItem(text) {
    const item = new vscode.CompletionItem(
        text,
        vscode.CompletionItemKind.Value
    );

    item.insertText = text;

    return item;
}

/**
 * @param {string} line
 * @param {number} character
 * @param {string} languageId
 * @returns {string|null}
 */
function commentTextUpTo(line, character, languageId) {
    const state = { inBlockComment: false };

    const ranges = getCommentRanges(languageId, line, state);

    for (const range of ranges) {
        if (
            character > range.start &&
            character <= range.end
        ) {
            return line.slice(range.start, character);
        }
    }

    return null;
}

/**
 * Suggests documentation anchors after a `file.md#` reference inside a
 * source comment.
 *
 * @implements {vscode.CompletionItemProvider}
 */
export class CommentCompletionProvider {

    /**
     * @param {vscode.TextDocument} document
     * @param {vscode.Position} position
     */
    provideCompletionItems(document, position) {
        const line = document.lineAt(position.line).text;

        const commentText = commentTextUpTo(
            line,
            position.character,
            document.languageId
        );

        if (commentText === null) {
            return [];
        }

        const reference = extractDocFileAfterHash(commentText);

        if (!reference) {
            return [];
        }

        const absolute = resolveWorkspacePath(reference.file);

        if (
            absolute === null ||
            !fs.existsSync(absolute)
        ) {
            return [];
        }

        const anchors = listAnchors(
            documentFromText(
                fs.readFileSync(absolute, "utf8"),
                "markdown"
            )
        );

        const range = anchorSuffixRange(
            commentText,
            reference.partialAnchor
        );

        return anchors.map((anchor) => {
            const item = anchorCompletionItem(anchor);

            item.range = new vscode.Range(
                position.line,
                range.start,
                position.line,
                range.end
            );

            return item;
        });
    }

}

/**
 * Suggests source anchors after a `## src/file.js — ` heading prefix in
 * a Markdown document.
 *
 * @implements {vscode.CompletionItemProvider}
 */
export class MarkdownCompletionProvider {

    /**
     * @param {vscode.TextDocument} document
     * @param {vscode.Position} position
     */
    provideCompletionItems(document, position) {
        const line = document.lineAt(position.line).text;

        const prefix = line.slice(0, position.character);

        const heading = extractHeadingSourceBeforeDash(prefix);

        if (!heading) {
            return [];
        }

        const absolute = resolveWorkspacePath(heading.source);

        if (
            absolute === null ||
            !fs.existsSync(absolute)
        ) {
            return [];
        }

        const languageId =
            getLanguageIdFromExtension(heading.source);

        if (languageId === null) {
            return [];
        }

        const sourceDocument = documentFromText(
            fs.readFileSync(absolute, "utf8"),
            languageId
        );

        const anchors = listSourceAnchors(
            sourceDocument,
            vscode.workspace.asRelativePath(
                document.uri,
                false
            )
        );

        return anchors.map(anchorCompletionItem);
    }

}
