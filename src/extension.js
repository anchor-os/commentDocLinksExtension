import * as vscode from "vscode";

import { CommentLinkProvider } from "./providers/commentLinkProvider.js";

import { registerOpenDocumentationCommand } from "./commands/openDocumentation.js";
import { registerOpenSourceCommand } from "./commands/openSource.js";
import { MarkdownLinkProvider }
    from "./providers/markdownLinkProvider.js";

import {
    DiagnosticsManager
} from "./diagnostics/diagnostics.js";

import {
    CommentCompletionProvider,
    MarkdownCompletionProvider
} from "./completion/completionProvider.js";

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

    context.subscriptions.push(

        vscode.languages.registerCompletionItemProvider(
            selector,
            new CommentCompletionProvider(),
            "#"
        )

    );

    context.subscriptions.push(

        vscode.languages.registerCompletionItemProvider(

            { language: "markdown" },

            new MarkdownCompletionProvider(),
            "—",
            "-"

        )

    );

    const diagnosticsManager = new DiagnosticsManager(
        vscode.languages.createDiagnosticCollection(
            "commentDocLinks"
        )
    );

    context.subscriptions.push(diagnosticsManager);

    const updateDiagnostics = (document) => {
        diagnosticsManager.update(document);
    };

    context.subscriptions.push(

        vscode.workspace.onDidOpenTextDocument(
            updateDiagnostics
        ),

        vscode.workspace.onDidChangeTextDocument((event) => {
            updateDiagnostics(event.document);
        }),

        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                updateDiagnostics(editor.document);
            }
        })

    );

    for (const document of vscode.workspace.textDocuments) {
        updateDiagnostics(document);
    }

}
