// @ts-check

import assert from "node:assert/strict";
import fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vscode from "vscode";
import { openDocumentationFile } from "../../src/commands/openDocumentation.js";
import { openSourceFile } from "../../src/commands/openSource.js";
import { revealAnchor } from "../../src/navigation/markdownNavigation.js";
import { revealSourceComment } from "../../src/navigation/sourceNavigation.js";
import { CommentLinkProvider } from "../../src/providers/commentLinkProvider.js";
import { MarkdownLinkProvider } from "../../src/providers/markdownLinkProvider.js";
import { openFile } from "../../src/services/navigation.js";

const FIXTURE_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "workspace",
);

function fixturePath(...parts) {
  return path.join(FIXTURE_ROOT, ...parts);
}

/**
 * Decode the arguments a command URI was built with.
 *
 * @param {vscode.Uri} uri
 * @returns {unknown[]}
 */
function commandUriArguments(uri) {
  return JSON.parse(uri.query);
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
      const current = vscode.workspace.workspaceFolders?.length ?? 0;

      updateInProgress = vscode.workspace.updateWorkspaceFolders(current, 0, { uri: folder });
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("Failed to open the fixture workspace folder");
}

const WORKTREE_ROOT = fixturePath("worktrees", "feature");

async function ensureWorktreeMarker() {
  const marker = path.join(WORKTREE_ROOT, ".git");

  if (fs.existsSync(marker)) {
    return;
  }

  fs.writeFileSync(marker, `gitdir: ${path.join(FIXTURE_ROOT, ".git", "worktrees", "feature")}\n`);
}

suite("Comment Doc Links extension", () => {
  suiteSetup(async () => {
    await openFixtureWorkspace();
    await ensureWorktreeMarker();
  });

  test("source comment provides a documentation link", async () => {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(fixturePath("src", "util", "foo.js")),
    );

    const links = new CommentLinkProvider().provideDocumentLinks(document);

    const matching = links.filter(
      (link) =>
        link.target.toString().includes("openReference") &&
        link.target.toString().includes("checkout-flow"),
    );

    assert.equal(matching.length, 1, "expected one anchored documentation link");

    const anchoredOnly = links.filter((link) => link.target.toString().includes("checkout-flow"));

    assert.equal(
      anchoredOnly.length,
      1,
      "the unanchored reference must not produce an anchored link",
    );
  });

  test("markdown heading provides a source link", async () => {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(fixturePath("documentation", "foo.md")),
    );

    const links = new MarkdownLinkProvider().provideDocumentLinks(document);

    const matching = links.filter(
      (link) =>
        link.target.toString().includes("openSource") &&
        link.target.toString().includes("checkout-flow"),
    );

    assert.equal(matching.length, 1, "expected one source link for the anchored heading");
  });

  test("block comment provides line-number documentation links", async () => {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(fixturePath("src", "util", "multiline.js")),
    );

    const links = new CommentLinkProvider().provideDocumentLinks(document);

    const lineLinks = links.filter(
      (link) =>
        link.target.toString().includes("openReference") &&
        link.target.toString().includes("foo.md"),
    );

    assert.equal(
      lineLinks.length,
      2,
      "expected two line-number documentation links in the block comment",
    );

    const lineNumbers = lineLinks.map((link) => commandUriArguments(link.target)[0].line);

    assert.ok(lineNumbers.includes(5), `expected a :5 link, got: ${lineNumbers.join(" | ")}`);

    assert.ok(lineNumbers.includes(7), `expected a #L7 link, got: ${lineNumbers.join(" | ")}`);
  });

  test("openDocumentation command reveals the requested line", async () => {
    const editor = await openDocumentationFile("documentation/foo.md", null, 5);

    assert.ok(editor, "expected an editor");

    assert.ok(
      editor.document.uri.fsPath.endsWith(path.join("documentation", "foo.md")),
      "expected foo.md to be open",
    );

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(line.includes("Checkout settles"), `expected the cursor on line 5, got: ${line}`);
  });

  test("revealAnchor moves the cursor to the requested line", async () => {
    const editor = await openFile(fixturePath("documentation", "foo.md"));

    revealAnchor(editor, null, 7);

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(line.includes("missing-anchor"), `expected the cursor on line 7, got: ${line}`);
  });

  test("revealAnchor moves the cursor to the anchored section", async () => {
    const editor = await openFile(fixturePath("documentation", "foo.md"));

    revealAnchor(editor, "checkout-flow");

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(
      line.includes("checkout-flow"),
      `expected the revealed line to be the heading, got: ${line}`,
    );
  });

  test("revealSourceComment moves the cursor to the matching comment", async () => {
    const editor = await openFile(fixturePath("src", "util", "foo.js"));

    revealSourceComment(editor, "documentation/foo.md", "checkout-flow");

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(
      line.includes("checkout-flow"),
      `expected the revealed line to be the comment, got: ${line}`,
    );
  });

  test("missing anchor still opens the file", async () => {
    const editor = await openFile(fixturePath("documentation", "foo.md"));

    revealAnchor(editor, "does-not-exist-anchor");

    assert.ok(
      editor.document.uri.fsPath.endsWith(path.join("documentation", "foo.md")),
      "expected foo.md to be open despite the missing anchor",
    );
  });

  test("diagnostics flag a broken reference", async () => {
    const document = await vscode.workspace.openTextDocument(
      vscode.Uri.file(fixturePath("src", "util", "bar.js")),
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

    assert.ok(diagnostics.length > 0, "expected at least one diagnostic");

    const messages = diagnostics.map((d) => d.message).join(" | ");

    assert.ok(
      messages.includes("missing.md"),
      `expected a missing-file diagnostic, got: ${messages}`,
    );
  });

  test("openDocumentation command reveals the anchored heading", async () => {
    const editor = await openDocumentationFile("documentation/foo.md", "checkout-flow");

    assert.ok(editor, "expected an editor");

    assert.ok(
      editor.document.uri.fsPath.endsWith(path.join("documentation", "foo.md")),
      "expected foo.md to be open",
    );

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(line.includes("checkout-flow"), `expected the cursor on the heading, got: ${line}`);
  });

  test("openDocumentation command opens the file without an anchor", async () => {
    const editor = await openDocumentationFile("documentation/foo.md", null);

    assert.ok(
      editor?.document.uri.fsPath.endsWith(path.join("documentation", "foo.md")),
      "expected foo.md to be open despite the missing anchor",
    );
  });

  test("openSource command opens the file when the anchor is missing", async () => {
    const editor = await openSourceFile(
      "src/util/foo.js",
      "missing-anchor",
      "documentation/foo.md",
    );

    assert.ok(editor, "expected an editor");

    assert.ok(
      editor.document.uri.fsPath.endsWith(path.join("src", "util", "foo.js")),
      "expected foo.js to be open despite the missing anchor",
    );

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(
      line.includes("documentation/foo.md") && !line.includes("#"),
      `expected the anchorless reference to be revealed, got: ${line}`,
    );
  });

  test("openDocumentation resolves links into a nested worktree", async () => {
    const sourcePath = fixturePath("worktrees", "feature", "src", "util", "foo.js");

    const editor = await openDocumentationFile(
      "documentation/foo.md",
      "worktree-flow",
      null,
      sourcePath,
    );

    assert.ok(editor, "expected an editor");

    assert.ok(
      editor.document.uri.fsPath.endsWith(
        path.join("worktrees", "feature", "documentation", "foo.md"),
      ),
      `expected the worktree copy of foo.md to be open, got: ${editor.document.uri.fsPath}`,
    );

    const line = editor.document.lineAt(editor.selection.active.line).text;

    assert.ok(
      line.includes("worktree-flow"),
      `expected the worktree heading to be revealed, got: ${line}`,
    );
  });

  test("openSource resolves links into a nested worktree", async () => {
    const documentationPath = fixturePath("worktrees", "feature", "documentation", "foo.md");

    const editor = await openSourceFile(
      "src/util/foo.js",
      "worktree-flow",
      "documentation/foo.md",
      documentationPath,
    );

    assert.ok(editor, "expected an editor");

    assert.ok(
      editor.document.uri.fsPath.endsWith(
        path.join("worktrees", "feature", "src", "util", "foo.js"),
      ),
      `expected the worktree copy of foo.js to be open, got: ${editor.document.uri.fsPath}`,
    );
  });

  test("commands are registered and do not throw", async () => {
    const openDocumentation = "commentDocLinks.openDocumentation";

    const openSource = "commentDocLinks.openSource";

    await assert.doesNotReject(
      vscode.commands.executeCommand(openDocumentation, "documentation/foo.md", null),
    );

    await assert.doesNotReject(
      vscode.commands.executeCommand(openSource, "src/util/foo.js", null, null),
    );

    await assert.doesNotReject(vscode.commands.executeCommand(openDocumentation, null, null));

    await assert.doesNotReject(vscode.commands.executeCommand(openSource, null, null, null));

    await assert.doesNotReject(vscode.commands.executeCommand(openDocumentation));

    await assert.doesNotReject(vscode.commands.executeCommand(openSource));
  });

  test("changing a referenced document updates dependent diagnostics only", async () => {
    const sourceUri = vscode.Uri.file(fixturePath("src", "util", "dep-index.js"));
    const markdownUri = vscode.Uri.file(fixturePath("documentation", "dep-index.md"));
    const unrelatedUri = vscode.Uri.file(fixturePath("src", "util", "bar.js"));

    await vscode.workspace.openTextDocument(sourceUri);
    const markdownDoc = await vscode.workspace.openTextDocument(markdownUri);
    await vscode.workspace.openTextDocument(unrelatedUri);

    const waitForDiagnostics = async (uri, predicate) => {
      const deadline = Date.now() + 10000;

      while (Date.now() < deadline) {
        const current = vscode.languages.getDiagnostics(uri);

        if (predicate(current)) {
          return current;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error(`timed out waiting 10s for diagnostics of ${uri.fsPath}`);
    };

    const messages = (uri) =>
      vscode.languages.getDiagnostics(uri).map((diagnostic) => diagnostic.message);

    const originalText = markdownDoc.getText();
    const replacedText = originalText.replace("— alpha", "— beta");

    assert.notEqual(
      replacedText,
      originalText,
      "the anchor rename must actually change the fixture",
    );

    const clean = await waitForDiagnostics(sourceUri, (current) => current.length === 0);

    assert.equal(clean.length, 0, "dep-index.js should start without diagnostics");

    // Capture the unrelated document's diagnostics once its background
    // scan has published them, so the post-edit assertion compares
    // against a live baseline instead of hardcoded fixture text.
    const unrelatedBaseline = (
      await waitForDiagnostics(unrelatedUri, (current) =>
        current.some((diagnostic) => diagnostic.message.includes("not found")),
      )
    ).map((diagnostic) => diagnostic.message);

    const markdownEditor = await vscode.window.showTextDocument(markdownDoc);

    try {
      await markdownEditor.edit((builder) => {
        builder.replace(
          new vscode.Range(markdownDoc.positionAt(0), markdownDoc.positionAt(originalText.length)),
          replacedText,
        );
      });

      const flagged = await waitForDiagnostics(sourceUri, (current) =>
        current.some((diagnostic) => diagnostic.message.includes("anchor not found")),
      );

      const flaggedMessages = flagged.map((diagnostic) => diagnostic.message);

      assert.ok(
        flaggedMessages.some((message) => message.includes("alpha")),
        `expected a missing-anchor diagnostic, got: ${flaggedMessages}`,
      );

      assert.deepEqual(
        messages(unrelatedUri),
        unrelatedBaseline,
        "unrelated bar.js diagnostics must be unchanged",
      );
    } finally {
      const editedText = markdownDoc.getText();

      await markdownEditor.edit((builder) => {
        builder.replace(
          new vscode.Range(markdownDoc.positionAt(0), markdownDoc.positionAt(editedText.length)),
          originalText,
        );
      });

      const restored = await waitForDiagnostics(sourceUri, (current) => current.length === 0);

      assert.equal(
        restored.length,
        0,
        "dep-index.js diagnostics must clear once the anchor is restored",
      );
    }
  });

  test("rapid consecutive edits to a referenced document coalesce dependent refreshes", async () => {
    const sourceUri = vscode.Uri.file(fixturePath("src", "util", "dep-index.js"));
    const markdownUri = vscode.Uri.file(fixturePath("documentation", "dep-index.md"));

    await vscode.workspace.openTextDocument(sourceUri);
    const markdownDoc = await vscode.workspace.openTextDocument(markdownUri);

    const waitForDiagnostics = async (uri, predicate) => {
      const deadline = Date.now() + 10000;

      while (Date.now() < deadline) {
        const current = vscode.languages.getDiagnostics(uri);

        if (predicate(current)) {
          return current;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error(`timed out waiting 10s for diagnostics of ${uri.fsPath}`);
    };

    const clean = await waitForDiagnostics(sourceUri, (current) => current.length === 0);

    assert.equal(clean.length, 0, "dep-index.js should start without diagnostics");

    const markdownEditor = await vscode.window.showTextDocument(markdownDoc);

    const originalText = markdownDoc.getText();

    const suffixes = ["beta", "gamma", "delta"];

    try {
      // A fast burst of edits to the referenced markdown heading.
      // Every edit invalidates the `alpha` anchor; if dependent
      // diagnostics refreshed per keystroke, each one would re-publish
      // dep-index.js synchronously.
      for (const suffix of suffixes) {
        const text = originalText.replace("— alpha", `— ${suffix}`);
        const currentText = markdownDoc.getText();

        assert.notEqual(text, currentText, "each burst edit must actually change the document");

        await markdownEditor.edit((builder) => {
          builder.replace(
            new vscode.Range(markdownDoc.positionAt(0), markdownDoc.positionAt(currentText.length)),
            text,
          );
        });
      }

      // The whole burst lands well inside the 250 ms debounce window,
      // so the dependent must still show its last published diagnostics:
      // a per-keystroke refresh would already flag it by now.
      const duringBurst = vscode.languages.getDiagnostics(sourceUri);

      assert.equal(duringBurst.length, 0, "rapid edits must not refresh dependents per keystroke");

      // Once the burst settles, the single coalesced pass must
      // eventually re-publish the dependent against the final text.
      const flagged = await waitForDiagnostics(sourceUri, (current) =>
        current.some((diagnostic) => diagnostic.message.includes("anchor not found")),
      );

      assert.ok(
        flagged.some((diagnostic) => diagnostic.message.includes("alpha")),
        "the coalesced refresh must report the missing alpha anchor",
      );
    } finally {
      await markdownEditor.edit((builder) => {
        const editedText = markdownDoc.getText();

        builder.replace(
          new vscode.Range(markdownDoc.positionAt(0), markdownDoc.positionAt(editedText.length)),
          originalText,
        );
      });

      const restored = await waitForDiagnostics(sourceUri, (current) => current.length === 0);

      assert.equal(
        restored.length,
        0,
        "dep-index.js diagnostics must clear once the anchor is restored",
      );
    }
  });

  test("renaming a referenced documentation file refreshes its dependents", async () => {
    const waitForDiagnostics = async (uri, predicate) => {
      const deadline = Date.now() + 10000;

      while (Date.now() < deadline) {
        const current = vscode.languages.getDiagnostics(uri);

        if (predicate(current)) {
          return current;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error(`timed out waiting 10s for diagnostics of ${uri.fsPath}`);
    };

    // The fixture workspace is shared by several concurrently running
    // extension hosts, so this test owns uniquely named files instead of
    // mutating the canonical fixtures.
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sourceUri = vscode.Uri.file(fixturePath("src", "util", `rename-${id}.js`));
    const targetUri = vscode.Uri.file(fixturePath("documentation", `rename-${id}.md`));
    const movedUri = vscode.Uri.file(fixturePath("documentation", `rename-${id}-moved.md`));

    const originalSourceText =
      `// See documentation/rename-${id}.md#alpha\n` +
      `export function renamed() {\n` +
      `    return "ok";\n` +
      `}\n`;
    const brokenSourceText = originalSourceText.replace("#alpha", "#missing");
    const originalTargetText =
      `# Rename fixture\n` +
      `\n` +
      `## src/util/rename-${id}.js — alpha\n` +
      `\n` +
      `Linked heading used by the rename E2E test.\n`;

    // The source starts with a deliberately broken reference. Waiting
    // for its "anchor not found" diagnostic proves the background scan
    // has actually indexed the source and built its reverse dependency
    // on the target, so the rename handler is guaranteed to find the
    // source as a dependent when it fires.
    await vscode.workspace.fs.writeFile(sourceUri, Buffer.from(brokenSourceText));
    await vscode.workspace.fs.writeFile(targetUri, Buffer.from(originalTargetText));

    let sourceDoc;

    try {
      sourceDoc = await vscode.workspace.openTextDocument(sourceUri);
      await vscode.workspace.openTextDocument(targetUri);

      await waitForDiagnostics(sourceUri, (current) =>
        current.some(
          (diagnostic) =>
            diagnostic.message.includes("anchor not found") &&
            diagnostic.message.includes("missing"),
        ),
      );

      // Fix the reference and wait for the diagnostics to clear:
      // that proves the re-scan re-linked the source to the target
      // before the rename below.
      const sourceEditor = await vscode.window.showTextDocument(sourceDoc);

      await sourceEditor.edit((builder) => {
        builder.replace(
          new vscode.Range(sourceDoc.positionAt(0), sourceDoc.positionAt(brokenSourceText.length)),
          originalSourceText,
        );
      });

      await waitForDiagnostics(sourceUri, (current) => current.length === 0);

      // A real rename through the workbench: WorkspaceEdit.renameFile
      // goes through the same path as an explorer rename, so
      // onDidRenameFiles fires and the extension re-indexes.
      const renameAway = new vscode.WorkspaceEdit();
      renameAway.renameFile(targetUri, movedUri);
      const applied = await vscode.workspace.applyEdit(renameAway);

      assert.equal(applied, true, "the referenced target rename must apply");

      // The dependent still points at the old path, which no longer
      // exists: the rename handler must re-publish its diagnostics.
      const broken = await waitForDiagnostics(sourceUri, (current) =>
        current.some((diagnostic) => diagnostic.message.includes("not found")),
      );

      assert.ok(
        broken.some((diagnostic) => diagnostic.message.includes(`rename-${id}.md`)),
        `expected a missing-file diagnostic, got: ${broken.map(
          (diagnostic) => diagnostic.message,
        )}`,
      );

      // The developer updates the comment to the new path. The edit
      // re-scans the source and its diagnostics clear again.
      const repointedSource = originalSourceText.replace(
        `rename-${id}.md#alpha`,
        `rename-${id}-moved.md#alpha`,
      );

      assert.notEqual(
        repointedSource,
        originalSourceText,
        "the repoint must actually change the source",
      );

      await sourceEditor.edit((builder) => {
        builder.replace(
          new vscode.Range(
            sourceDoc.positionAt(0),
            sourceDoc.positionAt(originalSourceText.length),
          ),
          repointedSource,
        );
      });

      await waitForDiagnostics(sourceUri, (current) => current.length === 0);

      // A later change to the renamed target must propagate to the
      // dependent now that it tracks the new path.
      const movedDoc = await vscode.workspace.openTextDocument(movedUri);
      const movedEditor = await vscode.window.showTextDocument(movedDoc);

      const currentMovedText = movedDoc.getText();
      const anchorBrokenText = currentMovedText.replace("— alpha", "— beta");

      assert.notEqual(
        anchorBrokenText,
        currentMovedText,
        "the anchor break must actually change the target",
      );

      await movedEditor.edit((builder) => {
        builder.replace(
          new vscode.Range(movedDoc.positionAt(0), movedDoc.positionAt(currentMovedText.length)),
          anchorBrokenText,
        );
      });

      const flagged = await waitForDiagnostics(sourceUri, (current) =>
        current.some((diagnostic) => diagnostic.message.includes("anchor not found")),
      );

      assert.ok(
        flagged.some((diagnostic) => diagnostic.message.includes("alpha")),
        `expected a missing-anchor diagnostic, got: ${flagged.map(
          (diagnostic) => diagnostic.message,
        )}`,
      );
    } finally {
      // Restore the source comment, then remove the owned files so
      // the shared fixture workspace stays pristine.
      if (sourceDoc) {
        try {
          const currentSourceText = sourceDoc.getText();

          if (currentSourceText !== originalSourceText) {
            const sourceEditor = await vscode.window.showTextDocument(sourceDoc);

            await sourceEditor.edit((builder) => {
              builder.replace(
                new vscode.Range(
                  sourceDoc.positionAt(0),
                  sourceDoc.positionAt(currentSourceText.length),
                ),
                originalSourceText,
              );
            });
          }
        } catch {
          // The source document may already be gone.
        }
      }

      for (const uri of [sourceUri, targetUri, movedUri]) {
        try {
          await vscode.workspace.fs.delete(uri);
        } catch {
          // The file is already absent; nothing to clean up.
        }
      }
    }
  }).timeout(120000);
});
