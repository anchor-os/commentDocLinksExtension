// @ts-check

/**
 * Reference type identifiers.
 *
 * Every recognized reference is normalized to one of these types. New
 * reference types (for example a generic `ticket`) can be added here and in
 * the parser without touching decoration/hover/diagnostics/navigation code —
 * those subsystems only ever switch on these stable identifiers.
 */
export const REFERENCE_TYPE = {
  DOCUMENTATION: "documentation",
  ISSUE: "issue",
  API: "api",
  TICKET: "ticket",
};

/**
 * Validation status of a resolved reference.
 *
 * Consumers (navigation, hover, diagnostics, decorations) treat these
 * statuses identically, so a reference is never "valid when clicked" but
 * "broken according to diagnostics".
 */
export const RESOLUTION_STATUS = {
  /** Target file exists and any anchor/line is valid. */
  VALID: "valid",

  /** Target file does not exist on disk. */
  MISSING_FILE: "missing-file",

  /** Target file exists but the requested anchor is not present. */
  MISSING_ANCHOR: "missing-anchor",

  /** Target file exists but the requested line is out of range. */
  INVALID_LINE: "invalid-line",

  /** Target path escapes the selected workspace/git root. */
  INVALID_PATH: "invalid-path",

  /** Reference type has no local target (issue/API/DOC-…). */
  EXTERNAL: "external",
};

/**
 * Short human-readable label used in hover/command messages.
 */
export const REFERENCE_LABELS = {
  [REFERENCE_TYPE.DOCUMENTATION]: "Documentation",
  [REFERENCE_TYPE.ISSUE]: "Issue",
  [REFERENCE_TYPE.API]: "API",
  [REFERENCE_TYPE.TICKET]: "Ticket",
};
