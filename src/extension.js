// @ts-check

import * as vscode from "vscode";
import { registerOpenDocumentationCommand } from "./commands/openDocumentation.js";
import { registerOpenReferenceCommand } from "./commands/openReference.js";
import { registerOpenSourceCommand } from "./commands/openSource.js";
import {
  CommentCompletionProvider,
  MarkdownCompletionProvider,
} from "./completion/completionProvider.js";
import { CONFIGURATION } from "./config/configuration.js";
import { DiagnosticsManager } from "./diagnostics/diagnostics.js";
import {
  documentsToRefresh,
  ReferenceDependencyIndex,
} from "./diagnostics/referenceDependencyIndex.js";
import { CustomBiomeLintProvider } from "./lint/CustomBiomeLintProvider.js";
import { LintCodeActionProvider } from "./lint/LintCodeActionProvider.js";
import { resolveLintConfig } from "./lint/LintConfig.js";
import { LintHoverProvider } from "./lint/LintHoverProvider.js";
import { isLintableLanguage, LintManager } from "./lint/LintManager.js";
import { documentSelector } from "./parsers/languageSupport.js";
import { CommentLinkProvider } from "./providers/commentLinkProvider.js";
import { ReferenceDecorationProvider } from "./providers/decorationProvider.js";
import { ReferenceHoverProvider } from "./providers/hoverProvider.js";
import { MarkdownLinkProvider } from "./providers/markdownLinkProvider.js";
import { createReferenceContext } from "./references/vscodeContext.js";
import { createDocumentScanner } from "./scanning/documentScanning.js";
import { PRIORITY, ScanScheduler } from "./scanning/scanScheduler.js";

export function activate(context) {
  const selector = documentSelector();

  registerOpenReferenceCommand(context);
  registerOpenDocumentationCommand(context);
  registerOpenSourceCommand(context);

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(selector, new CommentLinkProvider()),
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: "markdown" },
      new MarkdownLinkProvider(),
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, new ReferenceHoverProvider()),
  );

  const decorationProvider = new ReferenceDecorationProvider();

  decorationProvider.activate(context);

  context.subscriptions.push(decorationProvider);

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, new CommentCompletionProvider(), "#"),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "markdown" },
      new MarkdownCompletionProvider(),
      "—",
      "-",
    ),
  );

  const diagnosticsManager = new DiagnosticsManager(
    vscode.languages.createDiagnosticCollection("commentDocLinks"),
  );

  context.subscriptions.push(diagnosticsManager);

  // --- Custom Biome Lint subsystem -------------------------------------------------
  // Optional: only active when the workspace has `custom-biome-lint` installed.
  // Kept fully isolated from the reference/link feature above. The manager
  // never imports `vscode`; all IDE plumbing is injected through `lintHost`.

  const lintOutput = vscode.window.createOutputChannel("Custom Biome Lint");

  const lintCollection = vscode.languages.createDiagnosticCollection("custom-biome-lint");

  /** @type {import("./lint/LintManager.js").LintHost} */
  const lintHost = {
    getConfig() {
      const configuration = vscode.workspace.getConfiguration("commentDocLinks");

      return resolveLintConfig({
        enabled: configuration.get("lint.enabled"),
        autoDetect: configuration.get("lint.autoDetect"),
      });
    },
    setDiagnostics(document, descriptors) {
      const diagnostics = descriptors.map((descriptor) => {
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(
            descriptor.range.startLine,
            descriptor.range.startChar,
            descriptor.range.endLine,
            descriptor.range.endChar,
          ),
          descriptor.message,
          descriptor.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );

        diagnostic.source = descriptor.source;
        diagnostic.code = descriptor.code;
        // Recover the parsed descriptor (fix/suppression/docs) in the code
        // action + hover providers.
        diagnostic["custom-biome-lint"] = descriptor;

        return diagnostic;
      });

      lintCollection.set(document.uri, diagnostics);
    },
    clearDiagnostics(document) {
      lintCollection.delete(document.uri);
    },
    getDocumentText(document) {
      return document.getText();
    },
    log(message) {
      lintOutput.appendLine(message);
    },
  };

  const lintProvider = new CustomBiomeLintProvider();
  const lintManager = new LintManager({ host: lintHost, provider: lintProvider });

  context.subscriptions.push(lintCollection, lintOutput, lintProvider, lintManager);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [{ language: "javascript" }, { language: "javascriptreact" }],
      new LintCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
    vscode.languages.registerHoverProvider(
      [{ language: "javascript" }, { language: "javascriptreact" }],
      new LintHoverProvider(),
    ),
  );

  /** Lint a single document immediately (open / save / explicit command). */
  const lintNow = (document) => {
    if (document) {
      lintManager.lintDocument(document, { immediate: true });
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("commentDocLinks.lint.file", () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || !isLintableLanguage(editor.document.languageId)) {
        vscode.window.showInformationMessage(
          "Custom Biome Lint: open a JavaScript/JSX file to lint.",
        );
        return;
      }

      lintNow(editor.document);

      const status = lintManager.statusFor(editor.document.uri.fsPath);

      if (status === "NOT_INSTALLED") {
        vscode.window.showInformationMessage(
          "Custom Biome Lint: custom-biome-lint is not installed in this workspace.",
        );
      }
    }),
    vscode.commands.registerCommand("commentDocLinks.lint.restart", () => {
      lintProvider.clearCache();
      lintManager.restart(vscode.workspace.textDocuments);
      vscode.window.showInformationMessage("Custom Biome Lint: restarted.");
    }),
    vscode.commands.registerCommand("commentDocLinks.lint.status", () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor || !isLintableLanguage(editor.document.languageId)) {
        vscode.window.showInformationMessage("Custom Biome Lint: no active JavaScript/JSX file.");
        return;
      }

      const fsPath = editor.document.uri.fsPath;
      const status = lintManager.statusFor(fsPath);
      const error = lintManager.lastErrorFor(fsPath);

      vscode.window.showInformationMessage(
        `Custom Biome Lint: ${status}${error ? ` — ${error}` : ""}`,
      );
    }),
  );

  // --- End Custom Biome Lint subsystem ----------------------------------------------

  const dependencyIndex = new ReferenceDependencyIndex();

  const scanner = new ScanScheduler({ concurrency: 3 });

  const updateDiagnostics = (document) => {
    diagnosticsManager.update(document);
  };

  const openDocumentByPath = (fsPath) =>
    vscode.workspace.textDocuments.find((candidate) => candidate.uri.fsPath === fsPath);

  const openDocumentPaths = () =>
    new Set(vscode.workspace.textDocuments.map((document) => document.uri.fsPath));

  const updateDiagnosticsForPath = (fsPath) => {
    const document = openDocumentByPath(fsPath);

    if (document) {
      updateDiagnostics(document);
    }
  };

  const refreshDependentsOf = (targetPath) => {
    for (const sourcePath of dependencyIndex.dependentsOf(targetPath)) {
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
    },
  });

  // Coalesced variant of {@link refreshDependentsOf} used by the
  // background scanner. A scan of an edited target happens once per
  // change event; routing its dependent refresh through the debounce
  // means a fast edit burst only re-publishes each dependent once.
  const scheduleDependentRefreshOf = (targetPath) => {
    for (const sourcePath of dependencyIndex.dependentsOf(targetPath)) {
      scheduleDependentRefresh(sourcePath);
    }
  };

  const documentScanner = createDocumentScanner({
    dependencyIndex,
    scanner,
    contextFor: (fsPath) => createReferenceContext(fsPath),
    openDocumentByPath,
    readFile: (fsPath) => vscode.workspace.fs.readFile(vscode.Uri.file(fsPath)),
    updateDiagnostics,
    refreshDependents: scheduleDependentRefreshOf,
    openDocuments: () => vscode.workspace.textDocuments,
    activeDocument: () => vscode.window.activeTextEditor?.document,
  });

  const { queueOpenDocument, queueDocumentAtPath, queueAllOpenDocuments } = documentScanner;

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      // A newly opened document is almost always the user's focus:
      // scan it at the highest priority instead of synchronously.
      queueOpenDocument(document, PRIORITY.ACTIVE);

      // The document may be a target that other open documents
      // reference (for example a previously missing file that was
      // just created), so revalidate its dependents too.
      refreshDependentsOf(document.uri.fsPath);

      // Lint the freshly opened file (no-op for unsupported languages
      // and when custom-biome-lint is not installed).
      lintNow(document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      // Editing a referenced document invalidates the diagnostics
      // of the documents that link to it, so refresh the changed
      // document plus only those dependents — never every open
      // document. The changed document is queued (it is being
      // edited and therefore active); dependent refreshes are
      // debounced so a fast edit burst coalesces into one pass.
      const toRefresh = documentsToRefresh(
        dependencyIndex,
        event.document.uri.fsPath,
        openDocumentPaths(),
      );

      queueOpenDocument(event.document, PRIORITY.ACTIVE);

      for (const fsPath of toRefresh) {
        if (fsPath !== event.document.uri.fsPath) {
          scheduleDependentRefresh(fsPath);
        }
      }

      // Re-lint on edits, debounced so a keystroke burst coalesces.
      lintManager.lintDocument(event.document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      dependencyIndex.remove(document.uri.fsPath);
      diagnosticsManager.clear(document.uri);
      lintManager.clearDocument(document);
    }),
    vscode.workspace.onDidCreateFiles((event) => {
      for (const uri of event.files) {
        refreshDependentsOf(uri.fsPath);
      }
    }),
    vscode.workspace.onDidDeleteFiles((event) => {
      for (const uri of event.files) {
        // The deleted document may itself be an indexed source
        // (or a scanned cache entry); drop it before refreshing
        // the documents that reference it.
        dependencyIndex.remove(uri.fsPath);
        refreshDependentsOf(uri.fsPath);
      }
    }),
    vscode.workspace.onDidRenameFiles((event) => {
      for (const file of event.files) {
        const oldPath = file.oldUri.fsPath;
        const newPath = file.newUri.fsPath;

        // Snapshot the dependents before mutating the index:
        // remove(oldPath) drops the old path's own dependency
        // entries, so taking the snapshot afterwards would be
        // fragile if that ever changed the reverse index too.
        const oldDependents = dependencyIndex.dependentsOf(oldPath);

        // Remove stale old-path index data.
        dependencyIndex.remove(oldPath);

        // Re-scan the renamed document at its new path.
        queueDocumentAtPath(newPath, PRIORITY.OPEN);

        // Re-scan every source that previously referenced the
        // old path: after a target rename they must discover the
        // new path (or report the old one as unresolved).
        for (const dependentPath of oldDependents) {
          queueDocumentAtPath(dependentPath, PRIORITY.OPEN);
        }

        // Refresh diagnostics affected by the rename.
        refreshDependentsOf(oldPath);
        refreshDependentsOf(newPath);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIGURATION.SECTION)) {
        // A configuration change can alter validation, so drop
        // the scan cache and rescan every open document in the
        // background.
        dependencyIndex.reset();
        queueAllOpenDocuments();

        // A lint setting (enabled / autoDetect) may have changed:
        // re-evaluate every open JS/JSX file (lintManager clears
        // diagnostics for disabled / non-applicable files).
        for (const document of vscode.workspace.textDocuments) {
          if (isLintableLanguage(document.languageId)) {
            lintManager.lintDocument(document, { immediate: true });
          }
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDiagnostics(editor.document);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      // Lint on save so results reflect the persisted file.
      lintNow(document);
    }),
  );

  // Startup: return immediately and scan open documents in the
  // background, active document first. Nothing about this activation
  // blocks on filesystem work.
  queueAllOpenDocuments();
}
