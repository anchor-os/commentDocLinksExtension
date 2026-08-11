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
    resolveWorkspacePath,
    workspaceRelativePath
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
 * Build the block-comment state up to a line so that a block comment
 * opened on an earlier line is still recognized on the cursor line.
 *
 * @param {vscode.TextDocument} document
 * @param {number} lineIndex
 * @param {string} languageId
 * @returns {{ inBlockComment: boolean }}
 */
function commentStateBefore(document, lineIndex, languageId) {
    const state = { inBlockComment: false };

    for (let i = 0; i < lineIndex; i++) {
        getCommentRanges(
            languageId,
            document.lineAt(i).text,
            state
        );
    }

    return state;
}

/**
 * @param {string} line
 * @param {number} character
 * @param {string} languageId
 * @param {{ inBlockComment: boolean }} state
 * @returns {{ text: string, offset: number }|null}
 *   The comment text up to the cursor plus the character offset where the
 *   comment starts on the line.
 */
function commentTextUpTo(line, character, languageId, state) {
    const ranges = getCommentRanges(languageId, line, state);

    for (const range of ranges) {
        if (
            character > range.start &&
            character <= range.end
        ) {
            return {
                text: line.slice(range.start, character),
                offset: range.start
            };
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

        const comment = commentTextUpTo(
            line,
            position.character,
            document.languageId,
            commentStateBefore(
                document,
                position.line,
                document.languageId
            )
        );

        if (comment === null) {
            return [];
        }

        const reference = extractDocFileAfterHash(
            comment.text
        );

        if (!reference) {
            return [];
        }

        const absolute = resolveWorkspacePath(
            reference.file,
            vscode.workspace.getWorkspaceFolder(document.uri),
            document.uri.fsPath
        );

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
            comment.text,
            reference.partialAnchor
        );

        return anchors.map((anchor) => {
            const item = anchorCompletionItem(anchor);

            item.range = new vscode.Range(
                position.line,
                comment.offset + range.start,
                position.line,
                comment.offset + range.end
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

        const absolute = resolveWorkspacePath(
            heading.source,
            vscode.workspace.getWorkspaceFolder(document.uri),
            document.uri.fsPath
        );

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
            workspaceRelativePath(
                document.uri.fsPath,
                vscode.workspace.getWorkspaceFolder(document.uri)
            )
        );

        const needsLeadingSpace = !/\s$/.test(prefix);

        return anchors.map((anchor) => {
            const item = anchorCompletionItem(anchor);

            if (needsLeadingSpace) {
                item.insertText = ` ${anchor}`;

                item.range = new vscode.Range(
                    position,
                    position
                );
            }

            return item;
        });
    }

}
