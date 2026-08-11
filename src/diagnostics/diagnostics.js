// @ts-check

import * as vscode from "vscode";

import {
    getConfiguration
} from "../config/configuration.js";

import {
    supportsLanguage
} from "../parsers/languageSupport.js";

import {
    collectBrokenReferences
} from "./brokenReferenceScanner.js";

import {
    workspaceRelativePath
} from "../services/workspace.js";

import { createReferenceContext }
    from "../references/vscodeContext.js";

/**
 * Reports broken references as editor diagnostics.
 */
export class DiagnosticsManager {

    /**
     * @param {vscode.DiagnosticCollection} collection
     */
    constructor(collection) {
        this.collection = collection;
    }

    /**
     * Refresh diagnostics for a document.
     *
     * @param {vscode.TextDocument} document
     */
    update(document) {
        if (
            !supportsLanguage(document.languageId) ||
            !getConfiguration().enableDiagnostics
        ) {
            this.collection.delete(document.uri);
            return;
        }

        const workspaceFolder =
            vscode.workspace.getWorkspaceFolder(document.uri);

        const broken = collectBrokenReferences(
            document,
            createReferenceContext(document.uri.fsPath),
            workspaceRelativePath(
                document.uri.fsPath,
                workspaceFolder
            )
        );

        const diagnostics = broken.map(
            (reference) =>
                new vscode.Diagnostic(
                    new vscode.Range(
                        reference.line,
                        reference.start,
                        reference.line,
                        reference.end
                    ),
                    reference.message,
                    vscode.DiagnosticSeverity.Warning
                )
        );

        this.collection.set(document.uri, diagnostics);
    }

    /**
     * Clear diagnostics for a document.
     *
     * @param {vscode.Uri} uri
     */
    clear(uri) {
        this.collection.delete(uri);
    }

    dispose() {
        this.collection.dispose();
    }

}
