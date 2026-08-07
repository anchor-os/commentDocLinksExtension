// @ts-check

import * as vscode from "vscode";

import { revealAnchor }
    from "../navigation/markdownNavigation.js";

import { resolveWorkspacePath }
    from "../services/workspace.js";

import { openFile } from "../services/navigation.js";

import { COMMANDS } from "../constants.js";

export function registerOpenDocumentationCommand(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            COMMANDS.OPEN_DOCUMENTATION,

            /**
             * @param {string} relativePath
             * @param {string|null} anchor
             */
            async (relativePath, anchor) => {
                const fullPath =
                    resolveWorkspacePath(relativePath);

                if (!fullPath) {
                    vscode.window.showErrorMessage(
                        "No workspace folder is open."
                    );

                    return;
                }

                try {
                    const editor = await openFile(fullPath);

                    revealAnchor(editor, anchor);
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
