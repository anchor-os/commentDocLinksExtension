// @ts-check

import * as vscode from "vscode";
import path from "node:path";

/**
 * Resolve a workspace-relative path.
 *
 * The resolved path is normalized and rejected when it escapes the
 * workspace root (for example `../secrets.txt`).
 *
 * @param {string} relativePath
 * @param {vscode.WorkspaceFolder|undefined} workspaceFolder
 *   The folder the referencing document belongs to. Defaults to the first
 *   workspace folder when omitted.
 * @returns {string|null}
 */
export function resolveWorkspacePath(relativePath, workspaceFolder) {

    const workspace =
        workspaceFolder ??
        vscode.workspace.workspaceFolders?.[0];

    if (!workspace) {
        return null;
    }

    const root = path.resolve(workspace.uri.fsPath);
    const resolved = path.resolve(root, relativePath);

    const relative = path.relative(root, resolved);

    if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        return null;
    }

    return resolved;

}