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
} from "../navigation/sourceNavigation.js";

import { COMMANDS } from "../constants.js";

export function registerOpenSourceCommand(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            COMMANDS.OPEN_SOURCE,

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
                if (typeof source !== "string") {
                    return;
                }

                const file = resolveWorkspacePath(source);

                if (!file) {
                    vscode.window.showErrorMessage(
                        "No workspace folder is open."
                    );

                    return;
                }

                try {
                    const editor = await openFile(file);

                    if (documentationFile) {
                        revealSourceComment(
                            editor,
                            documentationFile,
                            anchor
                        );
                    }

                    return editor;
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
