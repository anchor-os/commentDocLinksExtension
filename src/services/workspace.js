// @ts-check

import * as vscode from "vscode";
import path from "node:path";

import {
    chooseRoot,
    findCheckoutRoot,
    resolveInRoot
} from "./pathResolution.js";

/**
 * Determine the root directory links in a document resolve against.
 *
 * The document's nearest git checkout root (main repo or linked
 * worktree) wins when it is more specific than the workspace folder;
 * otherwise the workspace folder is used.
 *
 * @param {vscode.WorkspaceFolder|undefined} workspaceFolder
 *   The folder the referencing document belongs to. Defaults to the
 *   first workspace folder when omitted.
 * @param {string} [contextPath]
 *   File system path of the referencing document.
 * @returns {string|null}
 */
export function resolveWorkspaceRoot(workspaceFolder, contextPath) {
    const workspace =
        workspaceFolder ??
        vscode.workspace.workspaceFolders?.[0];

    const roots = [];

    if (workspace) {
        roots.push(path.resolve(workspace.uri.fsPath));
    }

    if (contextPath) {
        const checkout = findCheckoutRoot(
            path.dirname(contextPath)
        );

        if (checkout) {
            roots.push(checkout);
        }
    }

    if (roots.length === 0) {
        return null;
    }

    return chooseRoot(roots, contextPath);
}

/**
 * Resolve a workspace-relative path.
 *
 * The path is resolved against the most specific root of the referencing
 * document (see {@link resolveWorkspaceRoot}) and rejected when it
 * escapes that root (for example `../secrets.txt`).
 *
 * @param {string} relativePath
 * @param {vscode.WorkspaceFolder|undefined} workspaceFolder
 *   The folder the referencing document belongs to. Defaults to the
 *   first workspace folder when omitted.
 * @param {string} [contextPath]
 *   File system path of the referencing document.
 * @returns {string|null}
 */
export function resolveWorkspacePath(
    relativePath,
    workspaceFolder,
    contextPath
) {
    const root = resolveWorkspaceRoot(
        workspaceFolder,
        contextPath
    );

    if (root === null) {
        return null;
    }

    return resolveInRoot(root, relativePath);
}

/**
 * Relative path of a document from the root its links resolve against,
 * normalized to forward slashes.
 *
 * @param {string} fsPath
 * @param {vscode.WorkspaceFolder|undefined} workspaceFolder
 * @returns {string}
 */
export function workspaceRelativePath(fsPath, workspaceFolder) {
    const root = resolveWorkspaceRoot(
        workspaceFolder,
        fsPath
    );

    if (root) {
        const relative = path.relative(root, fsPath);

        if (
            relative !== "" &&
            relative !== ".." &&
            !relative.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relative)
        ) {
            return relative.replace(/\\/g, "/");
        }
    }

    return vscode.workspace.asRelativePath(
        vscode.Uri.file(fsPath),
        false
    );
}
