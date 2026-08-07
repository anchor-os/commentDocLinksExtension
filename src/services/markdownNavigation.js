// @ts-check

import * as vscode from "vscode";

import { parseMarkdownHeading }
    from "../parsers/markdownParser.js";

/**
 * Jump to the documentation heading that carries the given anchor.
 *
 * Headings look like:
 *
 * ## src/util/salesDashboardV2/getRevenueByBusinessCategory2.js — reconciliation-guarantee
 *
 * @param {vscode.TextEditor} editor
 * @param {string|null} anchor
 */
export function revealAnchor(editor, anchor) {

    if (!anchor) {
        return;
    }

    const document = editor.document;

    for (let i = 0; i < document.lineCount; i++) {

        const parsed =
            parseMarkdownHeading(document.lineAt(i).text);

        if (!parsed || parsed.anchor !== anchor) {
            continue;
        }

        const position = new vscode.Position(i, 0);

        editor.selection = new vscode.Selection(
            position,
            position
        );

        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );

        return;

    }

}