// @ts-check

import * as vscode from "vscode";
import path from "node:path";

/**
 * Resolve a workspace-relative path.
 *
 * @param {string} relativePath
 * @returns {string|null}
 */
export function resolveWorkspacePath(relativePath) {

    const workspace = vscode.workspace.workspaceFolders?.[0];

    if (!workspace) {
        return null;
    }

    return path.join(
        workspace.uri.fsPath,
        relativePath
    );

}