// @ts-check

import * as vscode from "vscode";

import { parseMarkdownHeading }
    from "../parsers/markdownParser.js";

/**
 * @implements {vscode.DocumentLinkProvider}
 */
export class MarkdownLinkProvider {

    provideDocumentLinks(document) {

        const links = [];

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

            const uri = vscode.Uri.parse(

                `command:commentDocLinks.openSource?${
                    encodeURIComponent(
                        JSON.stringify([
                            parsed.source,
                            parsed.anchor,
                            vscode.workspace.asRelativePath(
                                document.uri,
                                false
                            )
                        ])
                    )
                }`

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