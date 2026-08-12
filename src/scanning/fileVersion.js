// @ts-check

import fs from "node:fs";
import { stat } from "node:fs/promises";

/**
 * Cheap version token for an on-disk document: `mtimeMs:size`. A change to
 * either invalidates the token, so a background scan cache entry is only
 * reused while the file is genuinely unchanged. Returns null when the file
 * does not exist.
 *
 * @param {string} targetPath
 * @returns {string|null}
 */
export function fileVersion(targetPath) {
    try {
        const statResult = fs.statSync(targetPath);
        return `${statResult.mtimeMs}:${statResult.size}`;
    } catch {
        return null;
    }
}

/**
 * Non-blocking variant used by background scan jobs so version checks on
 * the extension host thread stay on the worker pool.
 *
 * @param {string} targetPath
 * @returns {Promise<string|null>}
 */
export async function fileVersionAsync(targetPath) {
    try {
        const statResult = await stat(targetPath);
        return `${statResult.mtimeMs}:${statResult.size}`;
    } catch {
        return null;
    }
}
