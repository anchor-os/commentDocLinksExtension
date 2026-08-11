// @ts-check

import { parseComment }
    from "../references/referenceParser.js";

/**
 * Parse every reference found in a comment text.
 *
 * Thin re-export kept for backwards compatibility — the shared implementation
 * lives in `references/referenceParser.js`.
 *
 * @param {string} text
 * @param {number} [offset]
 */
export { parseComment };
