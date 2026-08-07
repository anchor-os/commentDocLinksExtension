// @ts-check

import * as vscode from "vscode";
import { revealAnchor }
    from "../services/markdownNavigation.js";
import { resolveWorkspacePath } from "../services/workspace.js";
import { openFile } from "../services/navigation.js";

export function registerOpenDocumentationCommand(context) {

    context.subscriptions.push(

        vscode.commands.registerCommand(

            "commentDocLinks.openDocumentation",

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

                const editor =
                    await openFile(fullPath);

                revealAnchor(editor, anchor);

            }

        )

    );

}