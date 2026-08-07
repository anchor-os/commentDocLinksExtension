// @ts-check

import * as vscode from "vscode";
import * as path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import {
    CommentLinkProvider
} from "../../src/providers/commentLinkProvider.js";

import {
    MarkdownLinkProvider
} from "../../src/providers/markdownLinkProvider.js";

import {
    openFile
} from "../../src/services/navigation.js";

import {
    revealAnchor
} from "../../src/navigation/markdownNavigation.js";

import {
    revealSourceComment
} from "../../src/navigation/sourceNavigation.js";

const FIXTURE_ROOT = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    "workspace"
);

function fixturePath(...parts) {
    return path.join(FIXTURE_ROOT, ...parts);
}

async function openFixtureWorkspace() {
    const current = vscode.workspace.workspaceFolders?.length ?? 0;

    await vscode.workspace.updateWorkspaceFolders(
        0,
        current,
        { uri: vscode.Uri.file(FIXTURE_ROOT) }
    );
}

suite("Comment Doc Links extension", () => {

    suiteSetup(async () => {
        await openFixtureWorkspace();
    });

    test("source comment provides a documentation link", async () => {
        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.file(fixturePath("src", "util", "foo.js"))
        );

        const links = new CommentLinkProvider()
            .provideDocumentLinks(document);

        const matching = links.filter((link) =>
            link.target.toString().includes("openDocumentation") &&
            link.target.toString().includes("reconciliation-guarantee")
        );

        assert.equal(
            matching.length,
            1,
            "expected one anchored documentation link"
        );

        const anchoredOnly = links.filter((link) =>
            link.target.toString().includes("reconciliation-guarantee")
        );

        assert.equal(
            anchoredOnly.length,
            1,
            "the unanchored reference must not produce an anchored link"
        );
    });

    test("markdown heading provides a source link", async () => {
        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.file(fixturePath("documentation", "foo.md"))
        );

        const links = new MarkdownLinkProvider()
            .provideDocumentLinks(document);

        const matching = links.filter((link) =>
            link.target.toString().includes("openSource") &&
            link.target.toString().includes("reconciliation-guarantee")
        );

        assert.equal(
            matching.length,
            1,
            "expected one source link for the anchored heading"
        );
    });

    test("revealAnchor moves the cursor to the anchored section", async () => {
        const editor = await openFile(
            fixturePath("documentation", "foo.md")
        );

        revealAnchor(editor, "reconciliation-guarantee");

        const line = editor.document
            .lineAt(editor.selection.active.line)
            .text;

        assert.ok(
            line.includes("reconciliation-guarantee"),
            `expected the revealed line to be the heading, got: ${line}`
        );
    });

    test("revealSourceComment moves the cursor to the matching comment", async () => {
        const editor = await openFile(
            fixturePath("src", "util", "foo.js")
        );

        revealSourceComment(
            editor,
            "documentation/foo.md",
            "reconciliation-guarantee"
        );

        const line = editor.document
            .lineAt(editor.selection.active.line)
            .text;

        assert.ok(
            line.includes("reconciliation-guarantee"),
            `expected the revealed line to be the comment, got: ${line}`
        );
    });

    test("missing anchor still opens the file", async () => {
        const editor = await openFile(
            fixturePath("documentation", "foo.md")
        );

        revealAnchor(editor, "does-not-exist-anchor");

        assert.ok(
            editor.document.uri.fsPath.endsWith(
                path.join("documentation", "foo.md")
            ),
            "expected foo.md to be open despite the missing anchor"
        );
    });

    test("diagnostics flag a broken reference", async () => {
        const document = await vscode.workspace.openTextDocument(
            vscode.Uri.file(fixturePath("src", "util", "bar.js"))
        );

        const deadline = Date.now() + 5000;

        let diagnostics = [];

        while (Date.now() < deadline) {
            diagnostics = vscode.languages.getDiagnostics(document.uri);

            if (diagnostics.length > 0) {
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        assert.ok(
            diagnostics.length > 0,
            "expected at least one diagnostic"
        );

        const messages = diagnostics.map((d) => d.message).join(" | ");

        assert.ok(
            messages.includes("missing.md"),
            `expected a missing-file diagnostic, got: ${messages}`
        );
    });

});
