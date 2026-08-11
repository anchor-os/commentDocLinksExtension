// @ts-check

import * as vscode from "vscode";

import { revealAnchor }
    from "../navigation/markdownNavigation.js";

import { openFile } from "../services/navigation.js";

import {
    createReferenceContext
} from "../references/vscodeContext.js";

import {
    validateReference
} from "../references/resolver.js";

import {
    REFERENCE_TYPE,
    RESOLUTION_STATUS
} from "../references/referenceTypes.js";

import { COMMANDS } from "../constants.js";

/**
 * Open the target of a reference.
 *
 * Handles every reference type through the shared resolver:
 *
 *  - Documentation references open the target file and reveal the anchor
 *    or line.
 *  - Issue and API references have no local target; an informational
 *    message is shown instead.
 *
 * @param {object} reference A parsed reference (see `parseReference`).
 * @param {string} [sourceDocumentPath]
 *   File system path of the document that references the target.
 * @returns {Promise<vscode.TextEditor|null>}
 */
export async function openReference(
    reference,
    sourceDocumentPath
) {
    const context = createReferenceContext(
        sourceDocumentPath
    );

    const result = validateReference(reference, context);

    if (
        reference.type === REFERENCE_TYPE.ISSUE ||
        reference.type === REFERENCE_TYPE.API
    ) {
        vscode.window.showInformationMessage(
            "This reference has no local target — " +
            "it is tracked by an external system."
        );

        return null;
    }

    if (result.status === RESOLUTION_STATUS.EXTERNAL) {
        return null;
    }

    if (
        result.status === RESOLUTION_STATUS.MISSING_FILE ||
        result.status === RESOLUTION_STATUS.INVALID_PATH
    ) {
        vscode.window.showErrorMessage(
            result.message
        );

        return null;
    }

    if (result.targetPath === null) {
        return null;
    }

    const editor = await openFile(result.targetPath);

    revealAnchor(editor, reference.anchor, result.line);

    return editor;
}

export function registerOpenReferenceCommand(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            COMMANDS.OPEN_REFERENCE,

            /**
             * @param {object} reference
             * @param {string} [sourceDocumentPath]
             */
            async (reference, sourceDocumentPath) => {
                if (!reference || typeof reference !== "object") {
                    return;
                }

                try {
                    await openReference(
                        reference,
                        sourceDocumentPath
                    );
                } catch (error) {
                    console.error(error);

                    vscode.window.showErrorMessage(
                        `Unable to open reference: ${reference.raw}`
                    );
                }
            }
        )
    );
}
