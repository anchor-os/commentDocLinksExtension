// @ts-check

import * as vscode from "vscode";

import {
    getCommentRanges,
    supportsLanguage
} from "../parsers/languageSupport.js";

import {
    parseComment
} from "../parsers/commentParser.js";

import {
    createCommandUri
} from "../utils/commandUri.js";

import { COMMANDS } from "../constants.js";

export class CommentLinkProvider {

    /**
     * @param {vscode.TextDocument} document
     */
    provideDocumentLinks(document) {
        if (!supportsLanguage(document.languageId)) {
            return [];
        }

        const links = [];

        const state = {
            inBlockComment: false
        };

        for (
            let lineNumber = 0;
            lineNumber < document.lineCount;
            lineNumber++
        ) {
            const line = document.lineAt(lineNumber);

            const commentRanges = getCommentRanges(
                document.languageId,
                line.text,
                state
            );

            for (const commentRange of commentRanges) {
                const commentText = line.text.slice(
                    commentRange.start,
                    commentRange.end
                );

                const matches = parseComment(
                    commentText,
                    commentRange.start
                );

                for (const match of matches) {
                    const range = new vscode.Range(
                        lineNumber,
                        match.start,
                        lineNumber,
                        match.end
                    );

                    const target = createCommandUri(
                        COMMANDS.OPEN_DOCUMENTATION,
                        match.file,
                        match.anchor,
                        match.line,
                        document.uri.fsPath
                    );

                    links.push(
                        new vscode.DocumentLink(range, target)
                    );
                }
            }
        }

        return links;
    }
}