// @ts-check

/**
 * When comment text up to the cursor ends in `file.md#`, return the
 * documentation file so anchors can be suggested.
 *
 * @param {string} text
 * @returns {{ file: string, partialAnchor: string } | null}
 */
export function extractDocFileAfterHash(text) {
    const match = text.match(
        /([A-Za-z0-9_./\\-]+\.md)#([A-Za-z0-9_-]*)$/
    );

    if (!match) {
        return null;
    }

    return {
        file: match[1],
        partialAnchor: match[2]
    };
}

/**
 * When a Markdown heading line up to the cursor ends with ` — ` (or the
 * legacy ` - ` separator, with or without a trailing space), return the
 * source file so its anchors can be suggested.
 *
 * @param {string} text
 * @returns {{ source: string } | null}
 */
export function extractHeadingSourceBeforeDash(text) {
    const match = text.match(/^#{2,}\s+(.+?)\s+[—\-]\s*$/);

    if (!match) {
        return null;
    }

    return { source: match[1] };
}

/**
 * Index range (character offsets) of the partial anchor within the
 * comment text, used as the completion replace range.
 *
 * @param {string} text
 * @param {string} partialAnchor
 * @returns {{ start: number, end: number }}
 */
export function anchorSuffixRange(text, partialAnchor) {
    if (!partialAnchor) {
        return { start: text.length, end: text.length };
    }

    const start = text.lastIndexOf(partialAnchor);

    return { start, end: text.length };
}
