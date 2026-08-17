// @ts-check

import * as vscode from "vscode";

/**
 * Hover experience for custom-biome-lint diagnostics. Independent of the
 * existing comment/doc hover provider — it only reacts to diagnostics whose
 * `source` is `custom-biome-lint`, so existing hover behavior is untouched.
 */

const LINT_SOURCE = "custom-biome-lint";

/**
 * @implements {vscode.HoverProvider}
 */
export class LintHoverProvider {
  /**
   * @param {vscode.TextDocument} document
   * @param {vscode.Position} position
   * @returns {vscode.Hover|null}
   */
  provideHover(document, position) {
    const diagnostics = vscode.languages
      .getDiagnostics(document.uri)
      .filter((diagnostic) => diagnostic.source === LINT_SOURCE);

    for (const diagnostic of diagnostics) {
      if (!diagnostic.range.contains(position)) {
        continue;
      }

      const data = diagnostic[LINT_SOURCE];

      if (!data || typeof data !== "object") {
        return null;
      }

      /** @type {import("./LintDiagnosticMapper.js").DiagnosticDescriptor} */
      const descriptor = data;

      const markdown = new vscode.MarkdownString();

      markdown.appendMarkdown(`**custom-biome-lint/${descriptor.rule}**\n\n`);
      markdown.appendMarkdown(`${descriptor.message}\n\n`);
      markdown.appendMarkdown(`Severity: ${descriptor.severity}\n`);

      if (descriptor.docsUrl) {
        markdown.appendMarkdown(`\n[Open rule documentation](${descriptor.docsUrl})\n`);
      }

      markdown.isTrusted = true;

      return new vscode.Hover(markdown, diagnostic.range);
    }

    return null;
  }
}
