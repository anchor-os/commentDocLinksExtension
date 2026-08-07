// @ts-check

import * as vscode from "vscode";

/**
 * Find the documentation reference in a source file and reveal it.
 *
 * Source comments may reference the documentation file with or without
 * an anchor, in any of these styles:
 *
 *   — see documentation/claude/comments/ENC-74995.md
 *   — see documentation/claude/comments/ENC-74995.md#reconciliation-guarantee
 *   — see documentation/claude/comments/ENC-74995.md - reconciliation-guarantee
 *
 * @param {vscode.TextEditor} editor
 * @param {string} documentationFile
 * @param {string|null} anchor
 * @returns {boolean}
 */
export function revealSourceComment(
    editor,
    documentationFile,
    anchor
) {
    const document = editor.document;

    let fallback = null;

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
        const text = document.lineAt(lineNumber).text;

        if (!text.includes(documentationFile)) {
            continue;
        }

        if (
            anchor &&
            matchesAnchor(text, documentationFile, anchor)
        ) {
            return revealLine(editor, lineNumber);
        }

        if (fallback === null) {
            fallback = lineNumber;
        }
    }

    if (fallback !== null) {
        return revealLine(editor, fallback);
    }

    return false;
}

/**
 * @param {string} text
 * @param {string} documentationFile
 * @param {string} anchor
 * @returns {boolean}
 */
function matchesAnchor(text, documentationFile, anchor) {
    return (
        text.includes(`${documentationFile}#${anchor}`) ||
        text.includes(`${documentationFile} - ${anchor}`) ||
        text.includes(`${documentationFile} — ${anchor}`)
    );
}

/**
 * @param {vscode.TextEditor} editor
 * @param {number} lineNumber
 * @returns {true}
 */
function revealLine(editor, lineNumber) {
    const position = new vscode.Position(lineNumber, 0);

    editor.selection = new vscode.Selection(
        position,
        position
    );

    editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
    );

    return true;
}