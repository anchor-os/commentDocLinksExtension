// @ts-check

import * as vscode from "vscode";

import { openReference }
    from "./openReference.js";

import {
    REFERENCE_TYPE
} from "../references/referenceTypes.js";

import { COMMANDS } from "../constants.js";

/**
 * Open a documentation file and reveal the anchor or line.
 *
 * Backwards-compatible wrapper around {@link openReference} that keeps the
 * historical `(relativePath, anchor, line, sourceDocumentPath)` argument
 * shape for command URIs produced before the unified command existed.
 *
 * @param {string} relativePath
 * @param {string|null} anchor
 * @param {number|null} line
 * @param {string} [sourceDocumentPath]
 * @returns {Promise<vscode.TextEditor|null>}
 */
export async function openDocumentationFile(
    relativePath,
    anchor,
    line,
    sourceDocumentPath
) {
    return openReference(
        {
            type: REFERENCE_TYPE.DOCUMENTATION,
            raw: relativePath,
            file: relativePath,
            anchor,
            line,
            identifier: null
        },
        sourceDocumentPath
    );
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
                    await openDocumentationFile(
                        relativePath,
                        anchor,
                        line,
                        sourceDocumentPath
                    );
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
