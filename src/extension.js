import * as vscode from "vscode";

import { CommentLinkProvider } from "./providers/commentLinkProvider.js";

import { registerOpenDocumentationCommand } from "./commands/openDocumentation.js";
import { registerOpenSourceCommand } from "./commands/openSource.js";
import { MarkdownLinkProvider }
    from "./providers/markdownLinkProvider.js";

export function activate(context) {

    registerOpenDocumentationCommand(context);
    registerOpenSourceCommand(context);

    const selector = [

        { language: "javascript" },
        { language: "javascriptreact" },

        { language: "typescript" },
        { language: "typescriptreact" },

        { language: "graphql" },

        { language: "terraform" },

        { language: "yaml" },

        { language: "velocity" },

        { language: "markdown" }

    ];

    context.subscriptions.push(

        vscode.languages.registerDocumentLinkProvider(
            selector,
            new CommentLinkProvider()
        )

    );

    context.subscriptions.push(

    vscode.languages.registerDocumentLinkProvider(

        { language: "markdown" },

        new MarkdownLinkProvider()

    )

);

}