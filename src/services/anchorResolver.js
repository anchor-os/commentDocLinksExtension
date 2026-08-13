// @ts-check

import { parseMarkdownHeading } from "../parsers/markdownParser.js";

/**
 * @typedef {object} DocumentLike
 * @property {string} languageId
 * @property {number} lineCount
 * @property {(index: number) => { text: string }} lineAt
 */

/**
 * @typedef {object} Location
 * @property {number} line
 * @property {number} character
 */

/**
 * GitHub-style slug for a plain Markdown heading.
 *
 * `## Checkout Flow!` → `checkout-flow`
 * `## API & Errors`  → `api-errors`
 *
 * Surrounding whitespace is trimmed so it never leaks into the slug.
 *
 * @param {string} headingText
 * @returns {string}
 */
export function markdownSlug(headingText) {
  return headingText
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .replace(/ /g, "-");
}

/**
 * All headings in a document that carry an explicit source anchor
 * (`## src/file.js — anchor`), together with their positions.
 *
 * @param {DocumentLike} document
 * @returns {Array<{ anchor: string, line: number, character: number }>}
 */
function explicitAnchors(document) {
  const anchors = [];

  for (let i = 0; i < document.lineCount; i++) {
    const parsed = parseMarkdownHeading(document.lineAt(i).text);

    if (parsed) {
      anchors.push({
        anchor: parsed.anchor,
        line: i,
        character: 0,
      });
    }
  }

  return anchors;
}

/**
 * HTML anchor tags (`<a id="anchor"></a>`).
 *
 * @param {DocumentLike} document
 * @returns {Array<{ anchor: string, line: number, character: number }>}
 */
function htmlAnchors(document) {
  const anchors = [];

  for (let i = 0; i < document.lineCount; i++) {
    const match = document.lineAt(i).text.match(/<a id="([A-Za-z0-9_-]+)"><\/a>/);

    if (match) {
      anchors.push({
        anchor: match[1],
        line: i,
        character: 0,
      });
    }
  }

  return anchors;
}

/**
 * Plain Markdown headings (no explicit `— anchor` suffix), normalized with
 * the GitHub-style slug. Repeated slugs get numeric suffixes (`foo`, `foo-1`,
 * `foo-2`, …) while a heading literally named `Foo-1` keeps its own slug, so
 * generated suffixes never collide with it.
 *
 * @param {DocumentLike} document
 * @returns {Array<{ anchor: string, line: number, character: number }>}
 */
function slugAnchors(document) {
  const anchors = [];
  const seen = new Set();

  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text;

    if (parseMarkdownHeading(text)) {
      continue;
    }

    const heading = text.match(/^#{1,6}\s+(.+)$/);

    if (!heading) {
      continue;
    }

    const slug = markdownSlug(heading[1]);

    if (!slug) {
      continue;
    }

    let candidate = slug;
    let n = 1;

    while (seen.has(candidate)) {
      candidate = `${slug}-${n}`;
      n++;
    }

    seen.add(candidate);
    anchors.push({
      anchor: candidate,
      line: i,
      character: 0,
    });
  }

  return anchors;
}

/**
 * Locate an anchor inside a Markdown document.
 *
 * Three representations are supported, in this order:
 *
 *  1. Explicit documentation headings:
 *
 *     ## src/checkout/cart.js — checkout-flow
 *
 *  2. HTML anchors:
 *
 *     <a id="checkout-flow"></a>
 *
 *  3. Plain Markdown headings, normalized to their GitHub-style slug:
 *
 *     ## Checkout Flow   →   checkout-flow
 *
 * Explicit anchors always win; the slug form is a fallback so ordinary
 * Markdown headings can be referenced too.
 *
 * @param {DocumentLike} document
 * @param {string} anchor
 * @returns {Location|null}
 */
export function resolveAnchor(document, anchor) {
  if (!anchor) {
    return null;
  }

  for (const entry of explicitAnchors(document)) {
    if (entry.anchor === anchor) {
      return { line: entry.line, character: entry.character };
    }
  }

  for (const entry of htmlAnchors(document)) {
    if (entry.anchor === anchor) {
      return { line: entry.line, character: entry.character };
    }
  }

  for (const entry of slugAnchors(document)) {
    if (entry.anchor === anchor) {
      return { line: entry.line, character: entry.character };
    }
  }

  return null;
}

/**
 * List every anchor defined in a Markdown document, in document order.
 *
 * Used by completion to suggest available anchors and by diagnostics to
 * detect broken anchor references.
 *
 * @param {DocumentLike} document
 * @returns {string[]}
 */
export function listAnchors(document) {
  const entries = [
    ...explicitAnchors(document),
    ...htmlAnchors(document),
    ...slugAnchors(document),
  ];

  entries.sort((a, b) => a.line - b.line || a.character - b.character);

  const anchors = [];

  for (const entry of entries) {
    if (!anchors.includes(entry.anchor)) {
      anchors.push(entry.anchor);
    }
  }

  return anchors;
}
