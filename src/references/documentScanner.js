// @ts-check

import { getCommentRanges, supportsLanguage } from "../parsers/languageSupport.js";
import { parseComment } from "./referenceParser.js";

/**
 * @typedef {object} TicketLink
 * @property {string} baseUrl
 * @property {RegExp} regex
 * @property {string|null} label
 */

/**
 * @typedef {object} DocumentLike
 * @property {string} languageId
 * @property {number} lineCount
 * @property {(index: number) => { text: string }} lineAt
 */

/**
 * @typedef {object} ScannedReference
 * @property {object} reference The parsed, position-aware reference.
 * @property {number} line Zero-based line number the reference is on.
 */

/**
 * Scan a whole document for references that live inside comments.
 *
 * This is the single shared entry point for every feature that needs the
 * full set of references in a document: link provider, hover, decorations
 * and diagnostics. Comment detection (including multiline block comments) is
 * handled here exactly once.
 *
 * @param {DocumentLike} document
 * @param {TicketLink[]} [ticketLinks]
 * @returns {ScannedReference[]}
 */
export function scanDocumentForReferences(document, ticketLinks = []) {
  if (!supportsLanguage(document.languageId)) {
    return [];
  }

  const results = [];
  const state = { inBlockComment: false, inString: null };

  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;

    const commentRanges = getCommentRanges(document.languageId, text, state);

    for (const range of commentRanges) {
      const matches = parseComment(text.slice(range.start, range.end), range.start, ticketLinks);

      for (const reference of matches) {
        results.push({ reference, line });
      }
    }
  }

  return results;
}
