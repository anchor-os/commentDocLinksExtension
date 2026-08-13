// @ts-check

import {
  ALTERNATE_SOURCE_SEPARATOR,
  ANCHOR_SEPARATOR,
  MARKDOWN_SOURCE_SEPARATOR,
} from "../constants.js";

/**
 * Matches a documentation heading:
 *
 *   ## src/checkout/cart.js — anchor
 *   ## src/checkout/cart.js - anchor
 *   ## src/checkout/cart.js#anchor
 *
 * The em dash is the canonical separator; `#` and ` - ` are tolerated so
 * existing documents keep working.
 */
const MARKDOWN_HEADING_REGEX = new RegExp(
  `^#{2,}\\s+(.+?)(?:\\s+${MARKDOWN_SOURCE_SEPARATOR}\\s+|` +
    `\\s+${ALTERNATE_SOURCE_SEPARATOR}\\s+|${ANCHOR_SEPARATOR})` +
    `([A-Za-z0-9_-]+)$`,
);

/**
 * Parse a documentation heading.
 *
 * Example:
 *
 * ## src/checkout/cart.js — checkout-flow
 *
 * @param {string} line
 * @returns {{
 *   source:string,
 *   anchor:string,
 *   start:number,
 *   end:number
 * } | null}
 */
export function parseMarkdownHeading(line) {
  const match = line.match(MARKDOWN_HEADING_REGEX);

  if (!match) {
    return null;
  }

  return {
    source: match[1],

    anchor: match[2],

    start: line.indexOf(match[1]),

    end: line.indexOf(match[1]) + match[1].length,
  };
}
