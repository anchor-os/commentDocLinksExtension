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
    documentsToRefresh,
    ReferenceDependencyIndex
} from "./diagnostics/referenceDependencyIndex.js";

import { createReferenceContext }
    from "./references/vscodeContext.js";

import { createDocumentScanner }
    from "./scanning/documentScanning.js";

import {
    ScanScheduler,
    PRIORITY
} from "./scanning/scanScheduler.js";

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

    const dependencyIndex = new ReferenceDependencyIndex();

    const scanner = new ScanScheduler({ concurrency: 3 });

    const updateDiagnostics = (document) => {
        diagnosticsManager.update(document);
    };

    const openDocumentByPath = (fsPath) =>
        vscode.workspace.textDocuments.find(
            (candidate) => candidate.uri.fsPath === fsPath
        );

    const openDocumentPaths = () =>
        new Set(
            vscode.workspace.textDocuments.map(
                (document) => document.uri.fsPath
            )
        );

    const updateDiagnosticsForPath = (fsPath) => {
        const document = openDocumentByPath(fsPath);

        if (document) {
            updateDiagnostics(document);
        }
    };

    const refreshDependentsOf = (targetPath) => {
        for (const sourcePath of
            dependencyIndex.dependentsOf(targetPath)) {
            updateDiagnosticsForPath(sourcePath);
        }
    };

    // Coalesce dependent refreshes across a fast burst of edits. Multiple
    // changes within the window only re-publish each dependent once.
    const DEPENDENT_REFRESH_DELAY_MS = 250;
    const pendingDependentRefresh = new Set();
    let dependentRefreshTimer = null;

    const scheduleDependentRefresh = (fsPath) => {
        pendingDependentRefresh.add(fsPath);

        if (dependentRefreshTimer !== null) {
            return;
        }

        dependentRefreshTimer = setTimeout(() => {
            dependentRefreshTimer = null;

            const paths = [...pendingDependentRefresh];

            pendingDependentRefresh.clear();

            for (const path of paths) {
                updateDiagnosticsForPath(path);
            }
        }, DEPENDENT_REFRESH_DELAY_MS);
    };

    context.subscriptions.push({
        dispose() {
            if (dependentRefreshTimer !== null) {
                clearTimeout(dependentRefreshTimer);
                dependentRefreshTimer = null;
            }

            pendingDependentRefresh.clear();
        }
    });

    // Coalesced variant of {@link refreshDependentsOf} used by the
    // background scanner. A scan of an edited target happens once per
    // change event; routing its dependent refresh through the debounce
    // means a fast edit burst only re-publishes each dependent once.
    const scheduleDependentRefreshOf = (targetPath) => {
        for (const sourcePath of
            dependencyIndex.dependentsOf(targetPath)) {
            scheduleDependentRefresh(sourcePath);
        }
    };

    const documentScanner = createDocumentScanner({
        dependencyIndex,
        scanner,
        contextFor: (fsPath) =>
            createReferenceContext(fsPath),
        openDocumentByPath,
        readFile: (fsPath) =>
            vscode.workspace.fs.readFile(
                vscode.Uri.file(fsPath)
            ),
        updateDiagnostics,
        refreshDependents: scheduleDependentRefreshOf,
        openDocuments: () => vscode.workspace.textDocuments,
        activeDocument: () =>
            vscode.window.activeTextEditor?.document
    });

    const {
        queueOpenDocument,
        queueDocumentAtPath,
        queueAllOpenDocuments
    } = documentScanner;

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(
            (document) => {
                // A newly opened document is almost always the user's focus:
                // scan it at the highest priority instead of synchronously.
                queueOpenDocument(document, PRIORITY.ACTIVE);

                // The document may be a target that other open documents
                // reference (for example a previously missing file that was
                // just created), so revalidate its dependents too.
                refreshDependentsOf(document.uri.fsPath);
            }
        ),
        vscode.workspace.onDidChangeTextDocument(
            (event) => {
                // Editing a referenced document invalidates the diagnostics
                // of the documents that link to it, so refresh the changed
                // document plus only those dependents — never every open
                // document. The changed document is queued (it is being
                // edited and therefore active); dependent refreshes are
                // debounced so a fast edit burst coalesces into one pass.
                const toRefresh = documentsToRefresh(
                    dependencyIndex,
                    event.document.uri.fsPath,
                    openDocumentPaths()
                );

                queueOpenDocument(event.document, PRIORITY.ACTIVE);

                for (const fsPath of toRefresh) {
                    if (fsPath !== event.document.uri.fsPath) {
                        scheduleDependentRefresh(fsPath);
                    }
                }
            }
        ),
        vscode.workspace.onDidCloseTextDocument(
            (document) => {
                dependencyIndex.remove(document.uri.fsPath);
                diagnosticsManager.clear(document.uri);
            }
        ),
        vscode.workspace.onDidCreateFiles(
            (event) => {
                for (const uri of event.files) {
                    refreshDependentsOf(uri.fsPath);
                }
            }
        ),
        vscode.workspace.onDidDeleteFiles(
            (event) => {
                for (const uri of event.files) {
                    // The deleted document may itself be an indexed source
                    // (or a scanned cache entry); drop it before refreshing
                    // the documents that reference it.
                    dependencyIndex.remove(uri.fsPath);
                    refreshDependentsOf(uri.fsPath);
                }
            }
        ),
        vscode.workspace.onDidRenameFiles(
            (event) => {
                for (const file of event.files) {
                    const oldPath = file.oldUri.fsPath;
                    const newPath = file.newUri.fsPath;

                    // Snapshot the dependents before mutating the index:
                    // remove(oldPath) drops the old path's own dependency
                    // entries, so taking the snapshot afterwards would be
                    // fragile if that ever changed the reverse index too.
                    const oldDependents =
                        dependencyIndex.dependentsOf(oldPath);

                    // Remove stale old-path index data.
                    dependencyIndex.remove(oldPath);

                    // Re-scan the renamed document at its new path.
                    queueDocumentAtPath(
                        newPath,
                        PRIORITY.OPEN
                    );

                    // Re-scan every source that previously referenced the
                    // old path: after a target rename they must discover the
                    // new path (or report the old one as unresolved).
                    for (const dependentPath of oldDependents) {
                        queueDocumentAtPath(
                            dependentPath,
                            PRIORITY.OPEN
                        );
                    }

                    // Refresh diagnostics affected by the rename.
                    refreshDependentsOf(oldPath);
                    refreshDependentsOf(newPath);
                }
            }
        ),
        vscode.workspace.onDidChangeConfiguration(
            (event) => {
                if (
                    event.affectsConfiguration(
                        CONFIGURATION.SECTION
                    )
                ) {
                    // A configuration change can alter validation, so drop
                    // the scan cache and rescan every open document in the
                    // background.
                    dependencyIndex.reset();
                    queueAllOpenDocuments();
                }
            }
        ),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                updateDiagnostics(editor.document);
            }
        })
    );

    // Startup: return immediately and scan open documents in the
    // background, active document first. Nothing about this activation
    // blocks on filesystem work.
    queueAllOpenDocuments();
}
