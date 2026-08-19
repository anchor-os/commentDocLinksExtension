// @ts-check

import { byteColumnToUtf16Char } from "./lintUtf16.js";
import { getRuleDocumentationUrl } from "./ruleDocumentation.js";

/**
 * Map parsed v1 {@link LintResult} violations to framework-agnostic
 * diagnostic descriptors. Keeping this free of `vscode` lets it be
 * unit-tested directly; the VS Code host turns descriptors into
 * `vscode.Diagnostic` objects.
 *
 * Coordinate contract (v1): lines are 1-based; columns are 1-based UTF-8
 * BYTE offsets. VS Code positions are 1-based line / 0-based UTF-16 code-unit
 * `character`. We convert each byte column to its UTF-16 code-unit index using
 * the source line text (supplied by the caller), so non-ASCII content BEFORE
 * the diagnostic is handled correctly. The conversion is delegated to
 * [byteColumnToUtf16Char] — the single source of truth shared with the
 * code-action provider.
 */

/**
 * @typedef {import("./LintResultParser.js").LintResult} LintResult
 * @typedef {import("./LintResultParser.js").LintViolation} LintViolation
 * @typedef {import("./LintResultParser.js").LintAction} LintAction
 */

/**
 * @typedef {object} DiagnosticDescriptor
 * @property {string} rule
 * @property {string} message Full message (`<message>\n\ncustom-biome-lint/<rule>`).
 * @property {"error"|"warning"} severity
 * @property {{ startLine: number, startChar: number, endLine: number, endChar: number }} range
 *   0-based line / 0-based UTF-16 character.
 * @property {string} source Always "custom-biome-lint".
 * @property {string} code Rule id (e.g. "no-native-map").
 * @property {{ kind: string|null, title: string|null, edits: import("./LintResultParser.js").LintEdit[] }|null} fix
 * @property {{ kind: string|null, title: string|null, edits: import("./LintResultParser.js").LintEdit[] }|null} suppression
 * @property {string|null} docsUrl
 */

/**
 * @param {LintAction[]} actions
 * @param {string} fallbackTitle
 * @returns {{ kind: string|null, title: string, edits: import("./LintResultParser.js").LintEdit[] }|null}
 */
function firstAction(actions, fallbackTitle) {
  const edits = actions.flatMap((a) => a.edits);
  if (edits.length === 0) return null;
  const kind = actions.find((a) => a.kind != null)?.kind ?? null;
  const title = actions.find((a) => a.title != null)?.title ?? fallbackTitle;
  return { kind, title, edits };
}

/**
 * @param {LintViolation} diagnostic
 * @param {string} [fileText] Full source text (for byte->UTF-16 conversion).
 * @returns {DiagnosticDescriptor}
 */
export function mapDiagnostic(diagnostic, fileText = "") {
  const lines = fileText.split("\n");

  const startLineNo = diagnostic.startLine ?? diagnostic.line ?? 1;
  const startByteCol = diagnostic.startColumn ?? diagnostic.col ?? 1;
  const startLineText = lines[startLineNo - 1] ?? "";
  const startChar = byteColumnToUtf16Char(startLineText, startByteCol);

  const endLineNo = diagnostic.endLine ?? startLineNo;
  const endLineText = lines[endLineNo - 1] ?? startLineText;
  let endChar;
  if (diagnostic.endLine != null && diagnostic.endColumn != null) {
    endChar = byteColumnToUtf16Char(endLineText, diagnostic.endColumn);
  } else {
    // Line-only rule: highlight the whole line.
    endChar = endLineText.length;
  }

  const docsUrl = diagnostic.docsUrl ?? getRuleDocumentationUrl(diagnostic.rule);

  return {
    rule: diagnostic.rule,
    message: `${diagnostic.message}\n\ncustom-biome-lint/${diagnostic.rule}`,
    severity: diagnostic.severity === "warning" ? "warning" : "error",
    range: {
      startLine: startLineNo - 1,
      startChar,
      endLine: endLineNo - 1,
      endChar,
    },
    source: "custom-biome-lint",
    code: diagnostic.rule,
    fix: firstAction(diagnostic.fixes, "Apply safe fix"),
    suppression: firstAction(diagnostic.suppressions, `Suppress ${diagnostic.rule}`),
    docsUrl,
  };
}

/**
 * @param {LintResult} result
 * @param {string} [fileText]
 * @returns {DiagnosticDescriptor[]}
 */
export function mapDiagnostics(result, fileText = "") {
  /** @type {DiagnosticDescriptor[]} */
  const out = [];
  for (const file of result.files ?? []) {
    for (const violation of file.violations ?? []) {
      out.push(mapDiagnostic(violation, fileText));
    }
  }
  return out;
}
