// @ts-check

import * as vscode from "vscode";

import { resolveAnchor } from "../services/anchorResolver.js";

/**
 * Jump to the documentation anchor in the opened Markdown editor.
 *
 * If the anchor cannot be found the file stays open at its current
 * position — a missing anchor never blocks navigation.
 *
 * @param {vscode.TextEditor} editor
 * @param {string|null} anchor
 */
export function revealAnchor(editor, anchor) {
    if (!anchor) {
        return;
    }

    const location = resolveAnchor(editor.document, anchor);

    if (!location) {
        return;
    }

    const position = new vscode.Position(
        location.line,
        location.character
    );

    editor.selection = new vscode.Selection(
        position,
        position
    );

    editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
    );
}
