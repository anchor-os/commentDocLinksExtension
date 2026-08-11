// @ts-check

import * as vscode from "vscode";
import fs from "node:fs";

import {
    resolveWorkspacePath
} from "../services/workspace.js";

/**
 * Build the resolution context used by every reference consumer.
 *
 * The referencing document (source file) determines the workspace/git root
 * that references resolve against — see `services/workspace.js`.
 *
 * @param {string|undefined} sourceDocumentPath
 * @returns {import("./resolver.js").ReferenceContext}
 */
export function createReferenceContext(sourceDocumentPath) {
    const workspaceFolder = sourceDocumentPath
        ? vscode.workspace.getWorkspaceFolder(
              vscode.Uri.file(sourceDocumentPath)
          )
        : undefined;

    return {
        resolveTargetPath(relativePath) {
            return resolveWorkspacePath(
                relativePath,
                workspaceFolder,
                sourceDocumentPath
            );
        },
        fs: createFileSystem()
    };
}

/**
 * Filesystem access that prefers the in-memory (possibly unsaved) text of an
 * open document over the copy on disk, mirroring what the user actually sees.
 *
 * @returns {import("./resolver.js").FileSystemLike}
 */
export function createFileSystem() {
    return {
        exists(targetPath) {
            return fs.existsSync(targetPath);
        },

        readText(targetPath) {
            const open = vscode.workspace.textDocuments.find(
                (candidate) =>
                    candidate.uri.fsPath === targetPath
            );

            if (open) {
                return open.getText();
            }

            try {
                return fs.readFileSync(targetPath, "utf8");
            } catch {
                return null;
            }
        }
    };
}

/**
 * Wrap a filesystem so each target is read at most once per batch.
 *
 * Used by consumers that validate many references in one pass (for example
 * decorations) so the same documentation file is not read repeatedly.
 *
 * @param {import("./resolver.js").FileSystemLike} fs
 * @returns {import("./resolver.js").FileSystemLike}
 */
export function memoizeFileSystem(fs) {
    /** @type {Map<string, string|null>} */
    const cache = new Map();

    return {
        exists(targetPath) {
            return fs.exists(targetPath);
        },

        readText(targetPath) {
            const cached = cache.get(targetPath);

            if (cached !== undefined) {
                return cached;
            }

            const text = fs.readText(targetPath);

            cache.set(targetPath, text);

            return text;
        }
    };
}
