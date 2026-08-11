// @ts-check

import * as vscode from "vscode";

import { revealAnchor }
    from "../navigation/markdownNavigation.js";

import { resolveWorkspacePath }
    from "../services/workspace.js";

import { openFile } from "../services/navigation.js";

import { COMMANDS } from "../constants.js";

/**
 * Open a documentation file and reveal the anchor or line.
 *
 * @param {string} relativePath
 * @param {string|null} anchor
 * @param {number|null} line
 * @param {string} [sourceDocumentPath]
 *   File system path of the source document that references the
 *   documentation file.
 * @returns {Promise<vscode.TextEditor|null>}
 */
export async function openDocumentationFile(
    relativePath,
    anchor,
    line,
    sourceDocumentPath
) {

    const workspaceFolder = sourceDocumentPath
        ? vscode.workspace.getWorkspaceFolder(
              vscode.Uri.file(sourceDocumentPath)
          )
        : undefined;

    const fullPath = resolveWorkspacePath(
        relativePath,
        workspaceFolder,
        sourceDocumentPath
    );

    if (!fullPath) {
        return null;
    }

    const editor = await openFile(fullPath);

    revealAnchor(editor, anchor, line);

    return editor;

}

export function registerOpenDocumentationCommand(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            COMMANDS.OPEN_DOCUMENTATION,

            /**
             * @param {string} relativePath
             * @param {string|null} anchor
             * @param {number|null} line
             * @param {string} [sourceDocumentPath]
             */
            async (
                relativePath,
                anchor,
                line,
                sourceDocumentPath
            ) => {
                if (typeof relativePath !== "string") {
                    return;
                }

                try {
                    const editor = await openDocumentationFile(
                        relativePath,
                        anchor,
                        line,
                        sourceDocumentPath
                    );

                    if (editor === null) {
                        vscode.window.showErrorMessage(
                            "No workspace folder is open."
                        );
                    }
                } catch (error) {
                    console.error(error);

                    vscode.window.showErrorMessage(
                        `Unable to open documentation: ${relativePath}`
                    );
                }
            }
        )
    );
}
