// @ts-check

import path from "node:path";
import fs from "node:fs";

/**
 * True when the directory contains a `.git` entry (directory for the
 * main checkout, file for a linked worktree or submodule).
 *
 * @param {string} directory
 * @returns {boolean}
 */
function hasGitEntry(directory) {
    try {
        const gitPath = path.join(directory, ".git");
        return (
            fs.statSync(gitPath).isDirectory() ||
            fs.lstatSync(gitPath).isFile()
        );
    } catch {
        return false;
    }
}

/**
 * Find the nearest git checkout root (main repository or linked
 * worktree) that contains `directory`.
 *
 * Walks up from `directory` until an ancestor contains a `.git` entry.
 * The walk stops at the first match, so a linked worktree nested inside
 * a larger repository resolves to the worktree root.
 *
 * @param {string} directory
 * @param {(candidate: string) => boolean} [hasEntry]
 *   Predicate used to detect a checkout root. Defaults to a real
 *   file-system check for a `.git` entry.
 * @returns {string|null}
 */
export function findCheckoutRoot(directory, hasEntry) {
    const check = hasEntry ?? hasGitEntry;

    let current = path.resolve(directory);

    for (;;) {
        if (check(current)) {
            return current;
        }

        const parent = path.dirname(current);

        if (parent === current) {
            return null;
        }

        current = parent;
    }
}

/**
 * Resolve a relative path against a root, rejecting paths that escape
 * the root.
 *
 * @param {string} root
 * @param {string} relativePath
 * @returns {string|null}
 */
export function resolveInRoot(root, relativePath) {
    const normalizedRoot = path.resolve(root);
    const resolved = path.resolve(normalizedRoot, relativePath);

    const relative = path.relative(normalizedRoot, resolved);

    if (
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        return null;
    }

    return resolved;
}

/**
 * True when `candidate` is `target` or an ancestor of `target`.
 *
 * @param {string} candidate
 * @param {string} target
 * @returns {boolean}
 */
function isAncestor(candidate, target) {
    const relative = path.relative(candidate, target);

    return (
        relative === "" ||
        (!relative.startsWith(`..${path.sep}`) &&
            relative !== ".." &&
            !path.isAbsolute(relative))
    );
}

/**
 * Pick the most specific root for a referencing document.
 *
 * Among the candidate roots, the deepest root that still contains the
 * document wins. This keeps links pointing at the copy of the file
 * inside a linked worktree when the worktree is nested inside the
 * workspace folder.
 *
 * @param {string[]} roots
 * @param {string} [contextPath]
 *   File system path of the referencing document.
 * @returns {string}
 */
export function chooseRoot(roots, contextPath) {
    const candidates = roots.map((root) => path.resolve(root));

    if (!contextPath || candidates.length <= 1) {
        return candidates[0];
    }

    const context = path.resolve(contextPath);

    let best = null;

    for (const candidate of candidates) {
        if (!isAncestor(candidate, context)) {
            continue;
        }

        if (best === null || candidate.length > best.length) {
            best = candidate;
        }
    }

    return best ?? candidates[0];
}
