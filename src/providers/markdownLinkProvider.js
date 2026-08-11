// @ts-check

import * as vscode from "vscode";

import { parseMarkdownHeading }
    from "../parsers/markdownParser.js";

import { createCommandUri }
    from "../utils/commandUri.js";

import { workspaceRelativePath }
    from "../services/workspace.js";

import { COMMANDS } from "../constants.js";

/**
 * @implements {vscode.DocumentLinkProvider}
 */
export class MarkdownLinkProvider {

    provideDocumentLinks(document) {

        const links = [];

        const workspaceFolder =
            vscode.workspace.getWorkspaceFolder(document.uri);

        const documentationFile =
            workspaceRelativePath(
                document.uri.fsPath,
                workspaceFolder
            );

        for (let i = 0; i < document.lineCount; i++) {

            const line = document.lineAt(i);

            const parsed =
                parseMarkdownHeading(line.text);

            if (!parsed) {
                continue;
            }

            const range = new vscode.Range(

                i,

                parsed.start,

                i,

                parsed.end

            );

            const uri = createCommandUri(
                COMMANDS.OPEN_SOURCE,
                parsed.source,
                parsed.anchor,
                documentationFile,
                document.uri.fsPath
            );

            links.push(

                new vscode.DocumentLink(
                    range,
                    uri
                )

            );

        }

        return links;

    }

}
