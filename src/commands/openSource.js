// @ts-check

import * as vscode from "vscode";

import {
    resolveWorkspacePath
} from "../services/workspace.js";

import {
    openFile
} from "../services/navigation.js";

import {
    revealSourceComment
} from "../services/sourceNavigation.js";

export function registerOpenSourceCommand(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "commentDocLinks.openSource",

            /**
             * @param {string} source
             * @param {string|null} anchor
             * @param {string|null} documentationFile
             */
            async (
                source,
                anchor,
                documentationFile
            ) => {
                const file = resolveWorkspacePath(source);

                if (!file) {
                    vscode.window.showErrorMessage(
                        "No workspace folder is open."
                    );

                    return;
                }

                try {
                    const editor = await openFile(file);

                    if (!documentationFile) {
                        return;
                    }

                    revealSourceComment(
                        editor,
                        documentationFile,
                        anchor
                    );
                } catch (error) {
                    console.error(error);

                    vscode.window.showErrorMessage(
                        `Unable to open source file: ${source}`
                    );
                }
            }
        )
    );
}