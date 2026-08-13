// @ts-check

import * as vscode from "vscode";

import { getConfiguration, linkColorValue } from "../config/configuration.js";
import { supportsLanguage } from "../parsers/languageSupport.js";
import { scanDocumentForReferences } from "../references/documentScanner.js";
import { RESOLUTION_STATUS } from "../references/referenceTypes.js";
import { validateReference } from "../references/resolver.js";
import { createReferenceContext, memoizeFileSystem } from "../references/vscodeContext.js";

const REFRESH_DELAY_MS = 250;

/**
 * Visually marks recognized references in the editor.
 *
 * Valid references use the theme-aware link color (plus optional underline);
 * broken references use theme error/warning colors. Colors are theme-aware
 * by default and configurable through `commentDocLinks.*` settings.
 */
export class ReferenceDecorationProvider {
  constructor() {
    this._validDecoration = null;
    this._errorDecoration = null;
    this._warningDecoration = null;
    this._timer = null;
  }

  /**
   * @param {vscode.ExtensionContext} context
   */
  activate(context) {
    this.applyConfiguration();

    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.refresh()),

      vscode.workspace.onDidChangeTextDocument((event) => this.scheduleRefresh(event.document)),

      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("commentDocLinks")) {
          this.applyConfiguration();
          this.refresh();
        }
      }),
    );

    this.refresh();
  }

  applyConfiguration() {
    this.disposeDecorations();

    const configuration = getConfiguration();

    if (!configuration.enableDecorations) {
      return;
    }

    this._validDecoration = vscode.window.createTextEditorDecorationType({
      color: linkColorValue(configuration.linkColor),
      textDecoration: configuration.linkUnderline ? "underline" : undefined,
    });

    this._errorDecoration = vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("editorError.foreground"),
    });

    this._warningDecoration = vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("editorWarning.foreground"),
    });
  }

  /**
   * @param {vscode.TextDocument} [changedDocument]
   */
  scheduleRefresh(changedDocument) {
    const editor = vscode.window.activeTextEditor;

    if (
      editor &&
      changedDocument &&
      changedDocument.uri.toString() !== editor.document.uri.toString()
    ) {
      return;
    }

    if (this._timer !== null) {
      clearTimeout(this._timer);
    }

    this._timer = setTimeout(() => {
      this._timer = null;
      this.refresh();
    }, REFRESH_DELAY_MS);
  }

  refresh() {
    const editor = vscode.window.activeTextEditor;

    if (!editor || !this._validDecoration) {
      return;
    }

    if (!supportsLanguage(editor.document.languageId)) {
      this.clear(editor);
      return;
    }

    const context = createReferenceContext(editor.document.uri.fsPath);

    const memoContext = {
      resolveTargetPath: context.resolveTargetPath,
      fs: memoizeFileSystem(context.fs),
    };

    /** @type {vscode.Range[]} */
    const validRanges = [];

    /** @type {vscode.Range[]} */
    const errorRanges = [];

    /** @type {vscode.Range[]} */
    const warningRanges = [];

    for (const { reference, line } of scanDocumentForReferences(editor.document)) {
      const range = new vscode.Range(line, reference.start, line, reference.end);

      const result = validateReference(reference, memoContext);

      switch (result.status) {
        case RESOLUTION_STATUS.VALID:
        case RESOLUTION_STATUS.EXTERNAL:
          validRanges.push(range);
          break;

        case RESOLUTION_STATUS.MISSING_FILE:
        case RESOLUTION_STATUS.INVALID_PATH:
          errorRanges.push(range);
          break;

        case RESOLUTION_STATUS.MISSING_ANCHOR:
        case RESOLUTION_STATUS.INVALID_LINE:
          warningRanges.push(range);
          break;
      }
    }

    editor.setDecorations(this._validDecoration, validRanges);

    editor.setDecorations(this._errorDecoration, errorRanges);

    editor.setDecorations(this._warningDecoration, warningRanges);
  }

  /**
   * @param {vscode.TextEditor} editor
   */
  clear(editor) {
    if (this._validDecoration) {
      editor.setDecorations(this._validDecoration, []);
    }

    if (this._errorDecoration) {
      editor.setDecorations(this._errorDecoration, []);
    }

    if (this._warningDecoration) {
      editor.setDecorations(this._warningDecoration, []);
    }
  }

  disposeDecorations() {
    this._validDecoration?.dispose();
    this._errorDecoration?.dispose();
    this._warningDecoration?.dispose();

    this._validDecoration = null;
    this._errorDecoration = null;
    this._warningDecoration = null;
  }

  dispose() {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    this.disposeDecorations();
  }
}
