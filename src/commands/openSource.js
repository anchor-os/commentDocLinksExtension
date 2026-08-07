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

/**
 * Open a source file and reveal the comment that references a
 * documentation file.
 *
 * @param {string} source
 * @param {string|null} anchor
 * @param {string|null} documentationFile
 * @returns {Promise<vscode.TextEditor|null>}
 */
export async function openSourceFile(
    source,
    anchor,
    documentationFile
) {

    const file = resolveWorkspacePath(source);

    if (!file) {
        return null;
    }

    const editor = await openFile(file);

    if (documentationFile) {
        revealSourceComment(
            editor,
            documentationFile,
            anchor
        );
    }

    return editor;

}

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

                try {
                    const editor = await openSourceFile(
                        source,
                        anchor,
                        documentationFile
                    );

                    if (editor === null) {
                        vscode.window.showErrorMessage(
                            "No workspace folder is open."
                        );
                    }
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
