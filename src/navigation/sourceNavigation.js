// @ts-check

import * as vscode from "vscode";

import { resolveSourceReference } from "../services/sourceResolver.js";

/**
 * Reveal the source comment that references a documentation file.
 *
 * @param {vscode.TextEditor} editor
 * @param {string} documentationFile
 * @param {string|null} anchor
 * @returns {boolean}
 */
export function revealSourceComment(editor, documentationFile, anchor) {
  const result = resolveSourceReference(editor.document, documentationFile, anchor);

  if (!result) {
    return false;
  }

  const position = new vscode.Position(result.line, result.character);

  editor.selection = new vscode.Selection(position, position);

  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);

  return true;
}
