// @ts-check

/**
 * Parse the machine-readable output of `custom-biome-lint --format json`
 * into a structured {@link LintResult}.
 *
 * This module is intentionally free of `vscode` and `child_process` so it
 * can be unit-tested in isolation. It only validates and normalizes the
 * JSON shape documented in docs/custom-biome-lint-integration.md.
 */

/**
 * @typedef {object} LintPosition 1-based line, 0-based UTF-16 column.
 * @property {number} line
 * @property {number} column
 */

/**
 * @typedef {object} LintEdit
 * @property {LintPosition} start
 * @property {LintPosition} end
 * @property {string} text
 */

/**
 * @typedef {object} LintFix
 * @property {"safe"|"unsafe"} kind
 * @property {string} title
 * @property {LintEdit[]} edits
 */

/**
 * @typedef {object} LintSuppression
 * @property {string} title
 * @property {LintEdit[]} edits
 */

/**
 * @typedef {object} LintDiagnostic
 * @property {string} rule
 * @property {string} message
 * @property {"error"|"warn"} severity
 * @property {{ start: LintPosition, end: LintPosition }} range
 * @property {LintFix|null} fix
 * @property {LintSuppression|null} suppression
 * @property {string|null} docsUrl
 */

/**
 * @typedef {object} LintResult
 * @property {LintDiagnostic[]} diagnostics
 */

/**
 * @param {unknown} position
 * @param {string} field
 * @returns {LintPosition|null}
 */
function parsePosition(position, field) {
  if (
    position &&
    typeof position === "object" &&
    typeof position.line === "number" &&
    typeof position.column === "number" &&
    Number.isFinite(position.line) &&
    Number.isFinite(position.column)
  ) {
    return { line: position.line, column: position.column };
  }

  throw new LintParseError(`invalid position in ${field}`);
}

/**
 * @param {unknown} raw
 * @returns {LintEdit|null}
 */
function parseEdit(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const start = parsePosition(raw.start, "edit.start");
  const end = parsePosition(raw.end, "edit.end");

  if (start === null || end === null || typeof raw.text !== "string") {
    throw new LintParseError("invalid edit");
  }

  return { start, end, text: raw.text };
}

/**
 * @param {unknown} raw
 * @returns {LintFix|null}
 */
function parseFix(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const kind = raw.kind === "unsafe" ? "unsafe" : "safe";
  const title = typeof raw.title === "string" ? raw.title : "Apply fix";
  const edits = Array.isArray(raw.edits)
    ? raw.edits.map(parseEdit).filter((edit) => edit !== null)
    : [];

  if (edits.length === 0) {
    return null;
  }

  return { kind, title, edits: /** @type {LintEdit[]} */ (edits) };
}

/**
 * @param {unknown} raw
 * @returns {LintSuppression|null}
 */
function parseSuppression(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const title = typeof raw.title === "string" ? raw.title : "Suppress rule";
  const edits = Array.isArray(raw.edits)
    ? raw.edits.map(parseEdit).filter((edit) => edit !== null)
    : [];

  if (edits.length === 0) {
    return null;
  }

  return { title, edits: /** @type {LintEdit[]} */ (edits) };
}

/**
 * @param {unknown} raw
 * @returns {LintDiagnostic}
 */
function parseDiagnostic(raw) {
  if (!raw || typeof raw !== "object") {
    throw new LintParseError("diagnostic must be an object");
  }

  const rule = raw.rule;
  const message = raw.message;
  const severity = raw.severity === "warn" ? "warn" : "error";

  if (typeof rule !== "string" || rule.length === 0) {
    throw new LintParseError("diagnostic.rule is required");
  }

  if (typeof message !== "string") {
    throw new LintParseError("diagnostic.message is required");
  }

  const start = parsePosition(raw.range?.start, "range.start");
  const end = parsePosition(raw.range?.end, "range.end");

  if (start === null || end === null) {
    throw new LintParseError("diagnostic.range is required");
  }

  const docsUrl = typeof raw.docsUrl === "string" ? raw.docsUrl : null;

  return {
    rule,
    message,
    severity,
    range: { start, end },
    fix: parseFix(raw.fix),
    suppression: parseSuppression(raw.suppression),
    docsUrl,
  };
}

/**
 * Parse raw stdout JSON into a {@link LintResult}.
 *
 * @param {string} stdout
 * @returns {LintResult}
 */
export function parseLintResult(stdout) {
  const trimmed = stdout.trim();

  if (trimmed.length === 0) {
    return { diagnostics: [] };
  }

  let json;

  try {
    json = JSON.parse(trimmed);
  } catch (cause) {
    throw new LintParseError(
      `stdout is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!json || typeof json !== "object" || !Array.isArray(json.diagnostics)) {
    throw new LintParseError("result is missing a diagnostics array");
  }

  const diagnostics = json.diagnostics.map(parseDiagnostic);

  return { diagnostics };
}

/**
 * Thrown when stdout cannot be interpreted as a lint result. Distinguishes
 * a parse failure from a normal "has violations" result.
 */
export class LintParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "LintParseError";
  }
}
