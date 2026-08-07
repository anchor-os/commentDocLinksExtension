// @ts-check

import * as vscode from "vscode";

import { revealAnchor }
    from "../navigation/markdownNavigation.js";

import { resolveWorkspacePath }
    from "../services/workspace.js";

import { openFile } from "../services/navigation.js";

import { COMMANDS } from "../constants.js";

/**
 * Open a documentation file and reveal the anchor.
 *
 * @param {string} relativePath
 * @param {string|null} anchor
 * @returns {Promise<vscode.TextEditor|null>}
 */
export async function openDocumentationFile(relativePath, anchor) {

    const fullPath = resolveWorkspacePath(relativePath);

    if (!fullPath) {
        return null;
    }

    const editor = await openFile(fullPath);

    revealAnchor(editor, anchor);

    return editor;

}

export function registerOpenDocumentationCommand(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            COMMANDS.OPEN_DOCUMENTATION,

            /**
             * @param {string} relativePath
             * @param {string|null} anchor
             */
            async (relativePath, anchor) => {
                if (typeof relativePath !== "string") {
                    return;
                }

                try {
                    const editor = await openDocumentationFile(
                        relativePath,
                        anchor
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
