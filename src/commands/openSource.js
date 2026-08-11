// @ts-check

import * as vscode from "vscode";

import {
    resolveWorkspacePath,
    resolveWorkspaceRoot
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
 * @param {string} [sourceDocumentPath]
 *   File system path of the Markdown document that references the
 *   source file.
 * @returns {Promise<vscode.TextEditor|null>}
 */
export async function openSourceFile(
    source,
    anchor,
    documentationFile,
    sourceDocumentPath
) {

    const workspaceFolder = sourceDocumentPath
        ? vscode.workspace.getWorkspaceFolder(
              vscode.Uri.file(sourceDocumentPath)
          )
        : undefined;

    const file = resolveWorkspacePath(
        source,
        workspaceFolder,
        sourceDocumentPath
    );

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
             * @param {string} [sourceDocumentPath]
             */
            async (
                source,
                anchor,
                documentationFile,
                sourceDocumentPath
            ) => {
                if (typeof source !== "string") {
                    return;
                }

                try {
                    const editor = await openSourceFile(
                        source,
                        anchor,
                        documentationFile,
                        sourceDocumentPath
                    );

                    if (editor === null) {
                        const root = resolveWorkspaceRoot(
                            sourceDocumentPath
                                ? vscode.workspace.getWorkspaceFolder(
                                      vscode.Uri.file(sourceDocumentPath)
                                  )
                                : undefined,
                            sourceDocumentPath
                        );

                        vscode.window.showErrorMessage(
                            root === null
                                ? "No workspace folder is open."
                                : `Unable to resolve source file: ${source}`
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
