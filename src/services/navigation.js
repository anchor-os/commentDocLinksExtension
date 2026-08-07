// @ts-check

import * as vscode from "vscode";

/**
 * @param {string} file
 * @returns {Promise<vscode.TextEditor>}
 */
export async function openFile(file) {

    const document =
        await vscode.workspace.openTextDocument(file);

    return vscode.window.showTextDocument(document);

}