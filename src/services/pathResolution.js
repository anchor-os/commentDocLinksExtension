// @ts-check

import fs from "node:fs";
import path from "node:path";

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
    return fs.statSync(gitPath).isDirectory() || fs.lstatSync(gitPath).isFile();
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
 * The check is two-fold: the path must stay inside the root lexically,
 * and — once symbolic links are followed — it must stay inside the
 * root physically. A symlink inside the workspace that points outside
 * (for example `node_modules` → `/etc`) therefore cannot be used to
 * reach files beyond the root.
 *
 * Paths that do not exist yet are allowed: the deepest existing ancestor
 * is resolved physically and the remainder is appended lexically, so
 * completion and diagnostics on not-yet-created files keep working.
 *
 * @param {string} root
 * @param {string} relativePath
 * @returns {string|null}
 */
export function resolveInRoot(root, relativePath) {
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, relativePath);

  const relative = path.relative(normalizedRoot, resolved);

  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return null;
  }

  const rootReal = realpathPrefix(normalizedRoot);
  const targetReal = realpathPrefix(resolved);

  if (rootReal === null || targetReal === null) {
    return null;
  }

  const physical = path.relative(rootReal.path, targetReal.path);

  if (physical === ".." || physical.startsWith(`..${path.sep}`) || path.isAbsolute(physical)) {
    return null;
  }

  return path.join(targetReal.path, ...targetReal.suffix);
}

/**
 * Real path of the deepest existing ancestor of `candidate`, plus the
 * non-existing path components below it.
 *
 * @param {string} candidate
 * @returns {{ path: string, suffix: string[] }|null}
 */
function realpathPrefix(candidate) {
  let current = candidate;
  const suffix = [];

  for (;;) {
    try {
      return {
        path: fs.realpathSync(current),
        suffix,
      };
    } catch {
      const parent = path.dirname(current);

      if (parent === current) {
        return null;
      }

      suffix.unshift(path.basename(current));
      current = parent;
    }
  }
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
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
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
