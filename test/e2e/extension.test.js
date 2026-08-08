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

import {
    openDocumentationFile
} from "../../src/commands/openDocumentation.js";

import {
    openSourceFile
} from "../../src/commands/openSource.js";

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
    const folder = vscode.Uri.file(FIXTURE_ROOT);

    const deadline = Date.now() + 10000;

    let updateInProgress = false;

    while (Date.now() < deadline) {
        if (vscode.workspace.getWorkspaceFolder(folder)) {
            return;
        }

        if (!updateInProgress) {
            const current =
                vscode.workspace.workspaceFolders?.length ?? 0;

            updateInProgress = vscode.workspace
                .updateWorkspaceFolders(
                    current,
                    0,
                    { uri: folder }
                );
        }

        await new Promise((resolve) =>
            setTimeout(resolve, 200)
        );
    }

    throw new Error(
        "Failed to open the fixture workspace folder"
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
            link.target.toString().includes("checkout-flow")
        );

        assert.equal(
            matching.length,
            1,
            "expected one anchored documentation link"
        );

        const anchoredOnly = links.filter((link) =>
            link.target.toString().includes("checkout-flow")
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
            link.target.toString().includes("checkout-flow")
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

        revealAnchor(editor, "checkout-flow");

        const line = editor.document
            .lineAt(editor.selection.active.line)
            .text;

        assert.ok(
            line.includes("checkout-flow"),
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
            "checkout-flow"
        );

        const line = editor.document
            .lineAt(editor.selection.active.line)
            .text;

        assert.ok(
            line.includes("checkout-flow"),
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

    test("openDocumentation command reveals the anchored heading", async () => {
        const editor = await openDocumentationFile(
            "documentation/foo.md",
            "checkout-flow"
        );

        assert.ok(editor, "expected an editor");

        assert.ok(
            editor.document.uri.fsPath.endsWith(
                path.join("documentation", "foo.md")
            ),
            "expected foo.md to be open"
        );

        const line = editor.document
            .lineAt(editor.selection.active.line)
            .text;

        assert.ok(
            line.includes("checkout-flow"),
            `expected the cursor on the heading, got: ${line}`
        );
    });

    test("openDocumentation command opens the file without an anchor", async () => {
        const editor = await openDocumentationFile(
            "documentation/foo.md",
            null
        );

        assert.ok(
            editor?.document.uri.fsPath.endsWith(
                path.join("documentation", "foo.md")
            ),
            "expected foo.md to be open despite the missing anchor"
        );
    });

    test("openSource command opens the file when the anchor is missing", async () => {
        const editor = await openSourceFile(
            "src/util/foo.js",
            "missing-anchor",
            "documentation/foo.md"
        );

        assert.ok(editor, "expected an editor");

        assert.ok(
            editor.document.uri.fsPath.endsWith(
                path.join("src", "util", "foo.js")
            ),
            "expected foo.js to be open despite the missing anchor"
        );

        const line = editor.document
            .lineAt(editor.selection.active.line)
            .text;

        assert.ok(
            line.includes("documentation/foo.md") &&
                !line.includes("#"),
            `expected the anchorless reference to be revealed, got: ${line}`
        );
    });

    test("commands are registered and do not throw", async () => {
        const openDocumentation =
            "commentDocLinks.openDocumentation";

        const openSource = "commentDocLinks.openSource";

        await assert.doesNotReject(
            vscode.commands.executeCommand(
                openDocumentation,
                "documentation/foo.md",
                null
            )
        );

        await assert.doesNotReject(
            vscode.commands.executeCommand(
                openSource,
                "src/util/foo.js",
                null,
                null
            )
        );

        await assert.doesNotReject(
            vscode.commands.executeCommand(
                openDocumentation,
                null,
                null
            )
        );

        await assert.doesNotReject(
            vscode.commands.executeCommand(
                openSource,
                null,
                null,
                null
            )
        );

        await assert.doesNotReject(
            vscode.commands.executeCommand(openDocumentation)
        );

        await assert.doesNotReject(
            vscode.commands.executeCommand(openSource)
        );
    });

});
