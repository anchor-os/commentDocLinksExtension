// @ts-check

import { findCustomBiomeLint } from "./installation.js";
import { LintProvider } from "./LintProvider.js";
import { LintExecutionError, runLint } from "./LintRunner.js";

/**
 * Lint provider backed by the workspace-installed `custom-biome-lint`
 * binary. Resolves the package per file (monorepo aware) and shells out
 * through {@link runLint}.
 *
 * Install roots are cached per workspace directory so a hot editing
 * session does not re-walk `node_modules` on every keystroke. The cache is
 * invalidated on `dispose()` and can be cleared by the manager on a
 * configuration/workspace refresh.
 */

export class CustomBiomeLintProvider extends LintProvider {
  /**
   * @param {{
   *   findInstall?: typeof findCustomBiomeLint,
   *   runLint?: typeof runLint,
   * }} [deps]
   */
  constructor({ findInstall = findCustomBiomeLint, runLint: runLintImpl = runLint } = {}) {
    super();
    this.#findInstall = findInstall;
    this.#runLint = runLintImpl;
    /** @type {Map<string, ReturnType<typeof findCustomBiomeLint>>} */
    this.#cache = new Map();
  }

  /** @type {typeof findCustomBiomeLint} */
  #findInstall;

  /** @type {typeof runLint} */
  #runLint;

  /**
   * Resolve (and cache) the install for a file's workspace.
   *
   * @param {string} file
   */
  #resolve(file) {
    const startDir = file.includes(pathSep) ? dirOf(file) : file;

    const cached = this.#cache.get(startDir);

    if (cached !== undefined) {
      // Cache distinguishes "not installed" (null) from "not yet resolved"
      // (absent). `null` is a valid cached value.
      return cached;
    }

    const install = this.#findInstall(startDir);

    this.#cache.set(startDir, install);

    return install;
  }

  /**
   * @param {string} file
   * @returns {boolean}
   */
  isAvailable(file) {
    return this.#resolve(file) !== null;
  }

  /**
   * @param {{ file: string, signal?: AbortSignal }} request
   * @returns {Promise<import("./LintResultParser.js").LintResult>}
   */
  async lint({ file, signal }) {
    const install = this.#resolve(file);

    if (install === null) {
      throw new LintExecutionError("custom-biome-lint is not installed in this workspace");
    }

    return this.#runLint({
      executable: install.executable,
      file,
      cwd: install.workspaceDir,
      signal,
    });
  }

  /** Drop cached installs (e.g. after a workspace refresh). */
  clearCache() {
    this.#cache.clear();
  }

  dispose() {
    this.clearCache();
  }
}

/**
 * @param {string} file
 * @returns {string}
 */
function dirOf(file) {
  const idx = Math.max(file.lastIndexOf("/"), file.lastIndexOf("\\"));

  return idx <= 0 ? file : file.slice(0, idx);
}

const pathSep = process.platform === "win32" ? "\\" : "/";
