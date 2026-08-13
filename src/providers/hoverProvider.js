// @ts-check

import * as vscode from "vscode";
import { supportsLanguage } from "../parsers/languageSupport.js";
import { scanDocumentForReferences } from "../references/documentScanner.js";

import { buildHoverMarkdown } from "../references/hoverContent.js";
import { validateReference } from "../references/resolver.js";
import { createReferenceContext } from "../references/vscodeContext.js";

/**
 * Explains recognized references on hover.
 *
 * @implements {vscode.HoverProvider}
 */
export class ReferenceHoverProvider {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   * @returns {vscode.Hover|null}
   */
  provideHover(document, position) {
    if (!supportsLanguage(document.languageId)) {
      return null;
    }

    const context = createReferenceContext(document.uri.fsPath);

    for (const { reference, line } of scanDocumentForReferences(document)) {
      if (
        line !== position.line ||
        position.character < reference.start ||
        position.character > reference.end
      ) {
        continue;
      }

      const result = validateReference(reference, context);

      return new vscode.Hover(new vscode.MarkdownString(buildHoverMarkdown(reference, result)));
    }

    return null;
  }
}
