// @ts-check

/**
 * Lint feature configuration. Pure and free of `vscode` so it can be
 * unit-tested; the VS Code host reads `commentDocLinks.lint.*` and passes
 * the resolved values in. Rule *severity* is never configured here — that
 * lives in the project's `package.json` (`ignoreBiomeExtensionRules`) and is
 * owned by the Rust linter.
 */

export const LINT_CONFIG = {
  ENABLED: "lint.enabled",
  AUTO_DETECT: "lint.autoDetect",
};

/**
 * @typedef {object} ResolvedLintConfig
 * @property {boolean} enabled Master switch for the lint feature.
 * @property {boolean} autoDetect Auto-discover custom-biome-lint per file.
 */

/**
 * Merge raw (possibly partial) configuration with documented defaults.
 *
 * @param {{ enabled?: unknown, autoDetect?: unknown }} [raw]
 * @returns {ResolvedLintConfig}
 */
export function resolveLintConfig(raw = {}) {
  return {
    enabled: asBoolean(raw.enabled, true),
    autoDetect: asBoolean(raw.autoDetect, true),
  };
}

/**
 * Whether the lint feature should run for a given file, considering both
 * the master switch and auto-detect.
 *
 * @param {ResolvedLintConfig} config
 * @param {boolean} installed Whether custom-biome-lint is installed here.
 * @returns {boolean}
 */
export function lintActive(config, installed) {
  if (!config.enabled) {
    return false;
  }

  // Disabling auto-detect turns the feature fully off regardless of whether
  // the package happens to be installed.
  if (!config.autoDetect) {
    return false;
  }

  return installed;
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}
