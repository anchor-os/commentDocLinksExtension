// @ts-check

import * as vscode from "vscode";

/**
 * Quick-fix + suppression code actions for custom-biome-lint diagnostics.
 *
 * The Rust linter is the single source of truth for *what* to fix and
 * *where* to place a suppression: it returns exact text edits. This provider
 * only turns those edits into native `WorkspaceEdit`s so the IDE keeps
 * correct undo behavior — it never computes fix/suppression placement.
 *
 * Diagnostic objects carry their parsed descriptor under
 * `customBiomeLint` (attached by the VS Code host in extension.js), which
 * is how this provider recovers the edit data.
 */

/**
 * @typedef {import("./LintDiagnosticMapper.js").DiagnosticDescriptor} DiagnosticDescriptor
 */

const LINT_SOURCE = "custom-biome-lint";

/**
 * @param {import("./LintResultParser.js").LintEdit} edit
 * @returns {vscode.Range}
 */
function toRange(edit) {
  return new vscode.Range(
    edit.start.line - 1,
    edit.start.column,
    edit.end.line - 1,
    edit.end.column,
  );
}

/**
 * @param {vscode.Uri} uri
 * @param {import("./LintResultParser.js").LintEdit[]} edits
 * @returns {vscode.WorkspaceEdit}
 */
function buildWorkspaceEdit(uri, edits) {
  const workspaceEdit = new vscode.WorkspaceEdit();

  for (const edit of edits) {
    workspaceEdit.replace(uri, toRange(edit), edit.text);
  }

  return workspaceEdit;
}

/**
 * @implements {vscode.CodeActionProvider}
 */
export class LintCodeActionProvider {
  /**
   * @param {vscode.Diagnostic} diagnostic
   * @returns {DiagnosticDescriptor|null}
   */
  static #descriptorOf(diagnostic) {
    const data = diagnostic[LINT_SOURCE];

    return data && typeof data === "object" ? /** @type {DiagnosticDescriptor} */ (data) : null;
  }

  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Range} range
   * @param {vscode.CodeActionContext} context
   * @returns {vscode.CodeAction[]}
   */
  provideCodeActions(document, _range, context) {
    /** @type {vscode.CodeAction[]} */
    const actions = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== LINT_SOURCE) {
        continue;
      }

      const descriptor = LintCodeActionProvider.#descriptorOf(diagnostic);

      if (!descriptor) {
        continue;
      }

      if (descriptor.fix && descriptor.fix.edits.length > 0) {
        const fixAction = new vscode.CodeAction(
          descriptor.fix.title || "Apply safe fix",
          vscode.CodeActionKind.QuickFix,
        );

        fixAction.diagnostics = [diagnostic];
        fixAction.edit = buildWorkspaceEdit(document.uri, descriptor.fix.edits);
        fixAction.isPreferred = descriptor.fix.kind === "safe";
        actions.push(fixAction);
      }

      if (descriptor.suppression && descriptor.suppression.edits.length > 0) {
        const suppressAction = new vscode.CodeAction(
          `Suppress ${descriptor.rule}`,
          vscode.CodeActionKind.QuickFix,
        );

        suppressAction.diagnostics = [diagnostic];
        suppressAction.edit = buildWorkspaceEdit(document.uri, descriptor.suppression.edits);
        actions.push(suppressAction);
      }
    }

    return actions;
  }
}

export const LINT_CODE_ACTION_KINDS = [vscode.CodeActionKind.QuickFix];
