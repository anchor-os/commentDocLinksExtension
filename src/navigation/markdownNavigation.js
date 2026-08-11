// @ts-check

import * as vscode from "vscode";

import { resolveAnchor } from "../services/anchorResolver.js";

/**
 * Jump to the documentation anchor or line in the opened Markdown editor.
 *
 * When `line` is provided (1-based), the cursor moves to that line. When
 * `anchor` is provided instead, the matching heading/HTML anchor is
 * revealed. If neither can be found the file stays open at its current
 * position — a missing anchor never blocks navigation.
 *
 * @param {vscode.TextEditor} editor
 * @param {string|null} anchor
 * @param {number|null} line
 */
export function revealAnchor(editor, anchor, line) {
    let position = null;

    if (typeof line === "number") {
        const target = line - 1;

        if (target >= 0 && target < editor.document.lineCount) {
            position = new vscode.Position(target, 0);
        }
    } else if (anchor) {
        const location = resolveAnchor(editor.document, anchor);

        if (location) {
            position = new vscode.Position(
                location.line,
                location.character
            );
        }
    }

    if (!position) {
        return;
    }

    editor.selection = new vscode.Selection(
        position,
        position
    );

    editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
    );
}
