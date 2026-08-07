// @ts-check

/**
 * Parse a documentation heading.
 *
 * Example:
 *
 * ## scripts/local/localGraphqlWorkerPool.js — timeout-exempt-keys
 * ## scripts/local/localGraphqlWorkerPool.js - timeout-exempt-keys
 * ## scripts/local/localGraphqlWorkerPool.js#timeout-exempt-keys
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

    const match = line.match(
        /^#{2,}\s+(.+?)(?:\s+—\s+|\s+-\s+|#)([A-Za-z0-9_-]+)$/
    );

    if (!match) {
        return null;
    }

    return {

        source: match[1],

        anchor: match[2],

        start: line.indexOf(match[1]),

        end: line.indexOf(match[1]) + match[1].length

    };

}