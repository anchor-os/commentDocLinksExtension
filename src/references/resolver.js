// @ts-check

import { listAnchors } from "../services/anchorResolver.js";

import { countLines, documentFromText } from "./document.js";

import { REFERENCE_TYPE, RESOLUTION_STATUS } from "./referenceTypes.js";

/**
 * @typedef {object} FileSystemLike
 * @property {(targetPath: string) => boolean} exists
 *   True when the absolute target path exists on disk.
 * @property {(targetPath: string) => string|null} readText
 *   UTF-8 text of the absolute target path, or null when unreadable.
 */

/**
 * @typedef {object} ReferenceContext
 * @property {(relativePath: string) => string|null} resolveTargetPath
 *   Resolve a workspace-relative reference to an absolute path inside the
 *   referencing document's root, or null when the path escapes that root.
 * @property {FileSystemLike} fs
 */

/**
 * @typedef {object} ResolutionResult
 * @property {string} status One of {@link RESOLUTION_STATUS}.
 * @property {string|null} targetPath Absolute path of the target file.
 * @property {number|null} line Validated 1-based line when the reference
 *   carries one.
 * @property {string|null} url Resolved click URL for ticket references.
 * @property {string|null} message Human-readable explanation for broken
 *   references, null otherwise.
 */

const MESSAGES = {
  [RESOLUTION_STATUS.MISSING_FILE]: "Documentation file not found: ",
  [RESOLUTION_STATUS.MISSING_ANCHOR]: "Documentation anchor not found: ",
  [RESOLUTION_STATUS.INVALID_LINE]: "Documentation line out of range: ",
  [RESOLUTION_STATUS.INVALID_PATH]: "Documentation path is not allowed",
};

/**
 * Resolve the filesystem target of a documentation reference.
 *
 * @param {{ file: string|null }} reference
 * @param {ReferenceContext} context
 * @returns {{ kind: "file", targetPath: string } |
 *           { kind: "invalid-path" } |
 *           { kind: "external" }}
 */
export function resolveReference(reference, context) {
  if (reference.file === null || reference.file === undefined) {
    return { kind: "external" };
  }

  const targetPath = context.resolveTargetPath(reference.file);

  if (targetPath === null) {
    return { kind: "invalid-path" };
  }

  return { kind: "file", targetPath };
}

/**
 * Validate a reference against the filesystem.
 *
 * This is the single source of truth for whether a reference is usable.
 * Navigation, hover, diagnostics and decorations all consume its result.
 *
 * @param {{
 *   type: string,
 *   file: string|null,
 *   anchor: string|null,
 *   line: number|null,
 *   identifier: string|null,
 *   url: string|null
 * }} reference
 * @param {ReferenceContext} context
 * @returns {ResolutionResult}
 */
export function validateReference(reference, context) {
  if (reference.type === REFERENCE_TYPE.DOCUMENTATION && reference.file !== null) {
    return validateDocumentationReference(reference, context);
  }

  if (reference.type === REFERENCE_TYPE.TICKET) {
    return {
      status: RESOLUTION_STATUS.EXTERNAL,
      targetPath: null,
      line: null,
      url: reference.url,
      message: null,
    };
  }

  return {
    status: RESOLUTION_STATUS.EXTERNAL,
    targetPath: null,
    line: null,
    url: null,
    message: null,
  };
}

/**
 * @param {{
 *   file: string|null,
 *   anchor: string|null,
 *   line: number|null
 * }} reference
 * @param {ReferenceContext} context
 * @returns {ResolutionResult}
 */
function validateDocumentationReference(reference, context) {
  const resolution = resolveReference(reference, context);

  if (resolution.kind === "invalid-path") {
    return {
      status: RESOLUTION_STATUS.INVALID_PATH,
      targetPath: null,
      line: null,
      message: MESSAGES[RESOLUTION_STATUS.INVALID_PATH],
    };
  }

  if (resolution.kind === "external") {
    return {
      status: RESOLUTION_STATUS.EXTERNAL,
      targetPath: null,
      line: null,
      url: null,
      message: null,
    };
  }

  const targetPath = resolution.targetPath;

  if (!context.fs.exists(targetPath)) {
    return {
      status: RESOLUTION_STATUS.MISSING_FILE,
      targetPath,
      line: null,
      message: MESSAGES[RESOLUTION_STATUS.MISSING_FILE] + reference.file,
    };
  }

  if (reference.line !== null) {
    return validateDocumentationLine(reference.line, targetPath, context);
  }

  if (reference.anchor !== null) {
    return validateDocumentationAnchor(reference.anchor, targetPath, context);
  }

  return {
    status: RESOLUTION_STATUS.VALID,
    targetPath,
    line: null,
    message: null,
  };
}

/**
 * @param {number} line
 * @param {string} targetPath
 * @param {ReferenceContext} context
 * @returns {ResolutionResult}
 */
function validateDocumentationLine(line, targetPath, context) {
  const text = context.fs.readText(targetPath);

  if (text === null) {
    return {
      status: RESOLUTION_STATUS.VALID,
      targetPath,
      line,
      message: null,
    };
  }

  const lineCount = countLines(text);

  if (line < 1 || line > lineCount) {
    return {
      status: RESOLUTION_STATUS.INVALID_LINE,
      targetPath,
      line: null,
      message: MESSAGES[RESOLUTION_STATUS.INVALID_LINE] + String(line),
    };
  }

  return {
    status: RESOLUTION_STATUS.VALID,
    targetPath,
    line,
    message: null,
  };
}

/**
 * @param {string} anchor
 * @param {string} targetPath
 * @param {ReferenceContext} context
 * @returns {ResolutionResult}
 */
function validateDocumentationAnchor(anchor, targetPath, context) {
  const text = context.fs.readText(targetPath);

  if (text === null) {
    return {
      status: RESOLUTION_STATUS.VALID,
      targetPath,
      line: null,
      message: null,
    };
  }

  if (!listAnchors(documentFromText(text, "markdown")).includes(anchor)) {
    return {
      status: RESOLUTION_STATUS.MISSING_ANCHOR,
      targetPath,
      line: null,
      message: MESSAGES[RESOLUTION_STATUS.MISSING_ANCHOR] + anchor,
    };
  }

  return {
    status: RESOLUTION_STATUS.VALID,
    targetPath,
    line: null,
    message: null,
  };
}
