// @ts-check

import { getRuleDocumentationUrl } from "./ruleDocumentation.js";

/**
 * Map parsed {@link LintResult} diagnostics to framework-agnostic
 * diagnostic descriptors. Keeping this free of `vscode` lets it be
 * unit-tested directly; the VS Code host turns descriptors into
 * `vscode.Diagnostic` objects.
 *
 * Position convention: the Rust contract uses 1-based lines and 0-based
 * UTF-16 columns. VS Code uses 0-based lines and 0-based characters, so we
 * convert the line here (columns are already 0-based and stay as-is).
 */

/**
 * @typedef {import("./LintResultParser.js").LintResult} LintResult
 * @typedef {import("./LintResultParser.js").LintDiagnostic} LintDiagnostic
 */

/**
 * @typedef {object} DiagnosticDescriptor
 * @property {string} rule
 * @property {string} message Full message shown to the user
 *   (`<message>\n\ncustom-biome-lint/<rule>`).
 * @property {"error"|"warn"} severity
 * @property {{ startLine: number, startChar: number, endLine: number, endChar: number }} range
 *   0-based line / 0-based character.
 * @property {string} source Always "custom-biome-lint".
 * @property {string} code Rule id (e.g. "no-native-map").
 * @property {import("./LintResultParser.js").LintFix|null} fix
 * @property {import("./LintResultParser.js").LintSuppression|null} suppression
 * @property {string|null} docsUrl
 */

/**
 * @param {LintDiagnostic} diagnostic
 * @returns {DiagnosticDescriptor}
 */
export function mapDiagnostic(diagnostic) {
  const docsUrl = diagnostic.docsUrl ?? getRuleDocumentationUrl(diagnostic.rule);

  return {
    rule: diagnostic.rule,
    message: `${diagnostic.message}\n\ncustom-biome-lint/${diagnostic.rule}`,
    severity: diagnostic.severity,
    range: {
      startLine: diagnostic.range.start.line - 1,
      startChar: diagnostic.range.start.column,
      endLine: diagnostic.range.end.line - 1,
      endChar: diagnostic.range.end.column,
    },
    source: "custom-biome-lint",
    code: diagnostic.rule,
    fix: diagnostic.fix,
    suppression: diagnostic.suppression,
    docsUrl,
  };
}

/**
 * @param {LintResult} result
 * @returns {DiagnosticDescriptor[]}
 */
export function mapDiagnostics(result) {
  return result.diagnostics.map(mapDiagnostic);
}
