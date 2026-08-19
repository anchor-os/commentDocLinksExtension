// @ts-check

/**
 * Provider contract for lint integrations.
 *
 * The rest of the extension talks only to this interface, never to
 * `child_process` or the CLI. A single implementation
 * (`CustomBiomeLintProvider`) backs `custom-biome-lint` today; the shape
 * leaves room for a future provider without over-engineering (no DI
 * framework, just a duck-typed object).
 *
 * @typedef {import("./LintResultParser.js").LintResult} LintResult
 */

/**
 * @typedef {object} LintRequest
 * @property {string} file Absolute path to the file to lint.
 * @property {string} [text] Current editor buffer text (enables stdin mode).
 * @property {AbortSignal} [signal] Optional cancellation.
 */

export class LintProvider {
  /**
   * Whether this provider can lint in the given workspace (package
   * installed, executable resolvable). Cheap and side-effect free.
   *
   * @param {string} _file Absolute path of a file in the workspace.
   * @returns {boolean}
   */
  isAvailable(_file) {
    throw new Error("LintProvider.isAvailable not implemented");
  }

  /**
   * Lint a file and return the parsed result.
   *
   * @param {LintRequest} _request
   * @returns {Promise<LintResult>}
   */
  lint(_request) {
    throw new Error("LintProvider.lint not implemented");
  }

  /**
   * Return the rule catalog (for the settings UI). Optional; the default
   * throws so subclasses only implement it if they support `--rules`.
   *
   * @param {string} _file Absolute path of a file in the workspace.
   * @returns {Promise<import("./LintResultParser.js").LintRule[]>}
   */
  rules(_file) {
    throw new Error("LintProvider.rules not implemented");
  }

  dispose() {}
}
