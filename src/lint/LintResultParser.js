// @ts-check

/**
 * Parse the machine-readable output of `custom-biome-lint --format json`
 * (protocol v1) into a structured {@link LintResult}.
 *
 * Envelope (always v1, even on a non-zero exit caused by violations):
 * {
 *   "version": 1,
 *   "files": [ { "path": "...", "violations": [ ... ] } ],
 *   "summary": { "errors": N, "warnings": N, ... }
 * }
 *
 * Coordinates: lines 1-based; columns 1-based UTF-8 *byte* offsets. Edits use
 * `replacement`; `endLine`/`endColumn` are OMITTED for line-only rules.
 *
 * This module is intentionally free of `vscode` and `child_process` so it can
 * be unit-tested in isolation. It only validates and normalizes the JSON shape.
 */

/**
 * @typedef {object} LintEdit 1-based byte-column edit.
 * @property {number} startLine
 * @property {number} startColumn 1-based UTF-8 byte column.
 * @property {number} endLine
 * @property {number} endColumn 1-based UTF-8 byte column.
 * @property {string} replacement
 */

/**
 * @typedef {object} LintAction A fix or suppression entry.
 * @property {"safe"|"unsafe"|"suppress"|string|null} kind
 * @property {string|null} title
 * @property {LintEdit[]} edits
 */

/**
 * @typedef {object} LintViolation
 * @property {string} rule
 * @property {string} message
 * @property {"error"|"warning"} severity
 * @property {number|null} line 1-based point line.
 * @property {number|null} col 1-based point byte column.
 * @property {number|null} startLine 1-based.
 * @property {number|null} startColumn 1-based byte column.
 * @property {number|null} endLine 1-based (omitted for line-only rules).
 * @property {number|null} endColumn 1-based byte column (omitted for line-only rules).
 * @property {LintAction[]} fixes
 * @property {LintAction[]} suppressions
 */

/**
 * @typedef {object} LintFile
 * @property {string} path
 * @property {LintViolation[]} violations
 */

/**
 * @typedef {object} LintSummary
 * @property {number} errors
 * @property {number} warnings
 * @property {number} filesWithViolations
 * @property {number} filesChecked
 * @property {number} filesCacheSkipped
 * @property {number} elapsedMs
 * @property {boolean} clean
 */

/**
 * @typedef {object} LintResult
 * @property {number} version
 * @property {LintFile[]} files
 * @property {LintSummary|null} summary
 */

/**
 * @typedef {object} LintRule Catalog entry from `--rules`.
 * @property {string} name
 * @property {string} description
 * @property {string} defaultSeverity
 * @property {boolean} enabledByDefault
 * @property {string[]} supportedExtensions
 */

/**
 * @param {unknown} raw
 * @returns {LintEdit|null}
 */
function parseEdit(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {any} */ (raw);
  if (
    typeof r.startLine !== "number" ||
    typeof r.startColumn !== "number" ||
    typeof r.endLine !== "number" ||
    typeof r.endColumn !== "number"
  ) {
    throw new LintParseError("invalid edit: startLine/startColumn/endLine/endColumn required");
  }
  return {
    startLine: r.startLine,
    startColumn: r.startColumn,
    endLine: r.endLine,
    endColumn: r.endColumn,
    replacement: typeof r.replacement === "string" ? r.replacement : "",
  };
}

/**
 * @param {unknown} raw
 * @returns {LintAction|null}
 */
function parseAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {any} */ (raw);
  const kind = typeof r.kind === "string" ? r.kind : null;
  const title = typeof r.title === "string" ? r.title : null;
  const edits = Array.isArray(r.edits) ? r.edits.map(parseEdit).filter((e) => e !== null) : [];
  return { kind, title, edits: /** @type {LintEdit[]} */ (edits) };
}

/**
 * @param {unknown} raw
 * @returns {LintViolation}
 */
function parseViolation(raw) {
  if (!raw || typeof raw !== "object") {
    throw new LintParseError("violation must be an object");
  }
  const r = /** @type {any} */ (raw);
  if (typeof r.rule !== "string" || r.rule.length === 0) {
    throw new LintParseError("violation.rule is required");
  }
  if (typeof r.message !== "string") {
    throw new LintParseError("violation.message is required");
  }
  const fixes = Array.isArray(r.fixes) ? r.fixes.map(parseAction).filter(Boolean) : [];
  const suppressions = Array.isArray(r.suppressions)
    ? r.suppressions.map(parseAction).filter(Boolean)
    : [];

  return {
    rule: r.rule,
    message: r.message,
    severity: r.severity === "warning" ? "warning" : "error",
    line: typeof r.line === "number" ? r.line : null,
    col: typeof r.col === "number" ? r.col : null,
    startLine: typeof r.startLine === "number" ? r.startLine : null,
    startColumn: typeof r.startColumn === "number" ? r.startColumn : null,
    endLine: typeof r.endLine === "number" ? r.endLine : null,
    endColumn: typeof r.endColumn === "number" ? r.endColumn : null,
    fixes: /** @type {LintAction[]} */ (fixes),
    suppressions: /** @type {LintAction[]} */ (suppressions),
  };
}

/**
 * @param {unknown} raw
 * @returns {LintFile}
 */
function parseFile(raw) {
  if (!raw || typeof raw !== "object") {
    throw new LintParseError("file entry must be an object");
  }
  const r = /** @type {any} */ (raw);
  const violations = Array.isArray(r.violations) ? r.violations.map(parseViolation) : [];
  return {
    path: typeof r.path === "string" ? r.path : "",
    violations: /** @type {LintViolation[]} */ (violations),
  };
}

/**
 * @param {unknown} raw
 * @returns {LintSummary|null}
 */
function parseSummary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = /** @type {any} */ (raw);
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    errors: num(r.errors),
    warnings: num(r.warnings),
    filesWithViolations: num(r.filesWithViolations),
    filesChecked: num(r.filesChecked),
    filesCacheSkipped: num(r.filesCacheSkipped),
    elapsedMs: num(r.elapsedMs),
    clean: typeof r.clean === "boolean" ? r.clean : false,
  };
}

/**
 * Parse raw stdout JSON into a {@link LintResult} (v1 envelope).
 *
 * @param {string} stdout
 * @returns {LintResult}
 */
export function parseLintResult(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return { version: 1, files: [], summary: null };
  }

  let json;
  try {
    json = JSON.parse(trimmed);
  } catch (cause) {
    throw new LintParseError(
      `stdout is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!json || typeof json !== "object" || !Array.isArray(json.files)) {
    throw new LintParseError("result is missing a files array");
  }
  if (json.version !== 1) {
    throw new LintParseError(`unexpected contract version: ${String(json.version)} (expected 1)`);
  }

  const files = /** @type {any[]} */ (json.files).map(parseFile);
  return { version: 1, files, summary: parseSummary(json.summary) };
}

/**
 * Parse `custom-biome-lint --rules` catalog output into {@link LintRule}[].
 * Accepts either a top-level array or an object with a `rules` array.
 *
 * @param {string} stdout
 * @returns {LintRule[]}
 */
export function parseRules(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return [];

  let json;
  try {
    json = JSON.parse(trimmed);
  } catch (cause) {
    throw new LintParseError(
      `rules output is not valid JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const list = Array.isArray(json) ? json : Array.isArray(json?.rules) ? json.rules : null;
  if (!list) {
    throw new LintParseError("rules output is not an array of rules");
  }

  return /** @type {any[]} */ (list).map((r) => ({
    name: String(r?.name ?? ""),
    description: String(r?.description ?? ""),
    defaultSeverity: String(r?.defaultSeverity ?? "error"),
    enabledByDefault: r?.enabledByDefault !== false,
    supportedExtensions: Array.isArray(r?.supportedExtensions)
      ? r.supportedExtensions.map(String)
      : [],
  }));
}

/**
 * Thrown when stdout cannot be interpreted as a v1 lint result. Distinguishes
 * a parse failure from a normal "has violations" result.
 */
export class LintParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "LintParseError";
  }
}
