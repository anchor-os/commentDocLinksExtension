// @ts-check

import * as vscode from "vscode";
import fs from "node:fs";

import {
    supportsLanguage
} from "../parsers/languageSupport.js";

import {
    collectBrokenReferences
} from "./brokenReferenceScanner.js";

import {
    resolveWorkspacePath,
    workspaceRelativePath
} from "../services/workspace.js";

/**
 * Reports broken documentation references as editor diagnostics.
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
        if (!supportsLanguage(document.languageId)) {
            return;
        }

        const workspaceFolder =
            vscode.workspace.getWorkspaceFolder(document.uri);

        const fsLike = {

            exists(relativePath) {
                const absolute = resolveWorkspacePath(
                    relativePath,
                    workspaceFolder,
                    document.uri.fsPath
                );

                return (
                    absolute !== null &&
                    fs.existsSync(absolute)
                );
            },

            readText(relativePath) {
                const absolute = resolveWorkspacePath(
                    relativePath,
                    workspaceFolder,
                    document.uri.fsPath
                );

                if (absolute === null) {
                    return null;
                }

                const open = vscode.workspace.textDocuments.find(
                    (candidate) =>
                        candidate.uri.fsPath === absolute
                );

                if (open) {
                    return open.getText();
                }

                try {
                    return fs.readFileSync(absolute, "utf8");
                } catch {
                    return null;
                }
            }

        };

        const broken = collectBrokenReferences(
            document,
            fsLike,
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
