// @ts-check

import * as vscode from "vscode";

import {
    documentSelector
} from "./parsers/languageSupport.js";

import { CommentLinkProvider }
    from "./providers/commentLinkProvider.js";

import { MarkdownLinkProvider }
    from "./providers/markdownLinkProvider.js";

import { ReferenceHoverProvider }
    from "./providers/hoverProvider.js";

import { ReferenceDecorationProvider }
    from "./providers/decorationProvider.js";

import { registerOpenReferenceCommand }
    from "./commands/openReference.js";

import { registerOpenDocumentationCommand }
    from "./commands/openDocumentation.js";

import { registerOpenSourceCommand }
    from "./commands/openSource.js";

import { DiagnosticsManager }
    from "./diagnostics/diagnostics.js";

import {
    CommentCompletionProvider,
    MarkdownCompletionProvider
} from "./completion/completionProvider.js";

import {
    CONFIGURATION
} from "./config/configuration.js";

export function activate(context) {
    const selector = documentSelector();

    registerOpenReferenceCommand(context);
    registerOpenDocumentationCommand(context);
    registerOpenSourceCommand(context);

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
        vscode.languages.registerHoverProvider(
            selector,
            new ReferenceHoverProvider()
        )
    );

    const decorationProvider = new ReferenceDecorationProvider();

    decorationProvider.activate(context);

    context.subscriptions.push(decorationProvider);

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

    const updateAllDiagnostics = () => {
        for (const document of vscode.workspace.textDocuments) {
            updateDiagnostics(document);
        }
    };

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(
            updateDiagnostics
        ),
        vscode.workspace.onDidChangeTextDocument(
            // Editing a referenced document can invalidate the diagnostics
            // of documents that link to it (missing file, anchor or line),
            // so refresh every open document rather than only the changed
            // one. The change handler already runs per document and the
            // number of open documents is small in practice.
            updateAllDiagnostics
        ),
        vscode.workspace.onDidCloseTextDocument(
            (document) => diagnosticsManager.clear(document.uri)
        ),
        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (
                    event.affectsConfiguration(
                        CONFIGURATION.SECTION
                    )
                ) {
                    updateAllDiagnostics();
                }
            }
        ),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                updateDiagnostics(editor.document);
            }
        })
    );

    updateAllDiagnostics();
}
