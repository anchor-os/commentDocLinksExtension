// @ts-check

import { scanDocumentForReferences } from "../references/documentScanner.js";

/**
 * @typedef {object} SourceReference
 * @property {number} line
 * @property {number} character
 * @property {boolean} anchorFound
 *   True when the requested anchor was matched exactly. When false the
 *   position still points at the best available location.
 */

/**
 * Compare documentation file paths ignoring a leading `./`, so a source
 * comment that writes `./docs/guide.md` still round-trips with reverse
 * navigation, which produces `docs/guide.md`.
 *
 * @param {string} file
 * @returns {string}
 */
function normalizedFile(file) {
  return file.startsWith("./") ? file.slice(2) : file;
}

/**
 * Find the source comment that references a documentation file.
 *
 * Resolution rules:
 *
 * - The exact reference `documentationFile#anchor` wins.
 * - If the file is referenced without the anchor, the first such
 *   reference is returned (anchorFound: false).
 * - If nothing references the file, the top of the source document is
 *   returned (anchorFound: false).
 *
 * The source file is assumed to be open (callers resolve existence
 * separately); this resolver never returns null for a valid document.
 *
 * Comment detection is shared with every other feature via
 * `scanDocumentForReferences`, so block comments and multiline strings are
 * handled exactly once.
 *
 * @param {import("../references/documentScanner.js").DocumentLike} document
 * @param {string} documentationFile
 * @param {string|null} anchor
 * @returns {SourceReference}
 */
export function resolveSourceReference(document, documentationFile, anchor) {
  let fallback = null;

  for (const { reference, line } of scanDocumentForReferences(document)) {
    if (normalizedFile(reference.file) !== normalizedFile(documentationFile)) {
      continue;
    }

    if (anchor && reference.anchor === anchor) {
      return {
        line,
        character: 0,
        anchorFound: true,
      };
    }

    if (reference.anchor === null && fallback === null) {
      fallback = {
        line,
        character: 0,
        anchorFound: false,
      };
    }
  }

  if (fallback !== null) {
    return fallback;
  }

  return {
    line: 0,
    character: 0,
    anchorFound: false,
  };
}

/**
 * True when the source document contains a comment that references the
 * documentation file with the exact anchor.
 *
 * @param {import("../references/documentScanner.js").DocumentLike} document
 * @param {string} documentationFile
 * @param {string} anchor
 * @returns {boolean}
 */
export function hasExactSourceReference(document, documentationFile, anchor) {
  if (!anchor) {
    return false;
  }

  for (const { reference } of scanDocumentForReferences(document)) {
    if (
      normalizedFile(reference.file) === normalizedFile(documentationFile) &&
      reference.anchor === anchor
    ) {
      return true;
    }
  }

  return false;
}

/**
 * List every anchor referenced by comments in the source document that
 * point at the given documentation file.
 *
 * @param {import("../references/documentScanner.js").DocumentLike} document
 * @param {string} documentationFile
 * @returns {string[]}
 */
export function listSourceAnchors(document, documentationFile) {
  const anchors = new Set();

  for (const { reference } of scanDocumentForReferences(document)) {
    if (
      normalizedFile(reference.file) === normalizedFile(documentationFile) &&
      reference.anchor !== null
    ) {
      anchors.add(reference.anchor);
    }
  }

  return [...anchors];
}
