// @ts-check

/**
 * Central, single-source mapping from a rule id to its documentation URL.
 *
 * Documentation URLs are intentionally NOT hardcoded at call sites. Add a
 * new rule here (or change {@link RULE_DOCUMENTATION_BASE}) and every
 * surface that links to docs (hover, diagnostics) picks it up. The Rust
 * linter may also supply a per-diagnostic `docsUrl` which wins over this
 * map (see LintDiagnosticMapper).
 */

/**
 * Base URL for rule documentation. Override per rule in {@link RULE_DOCS}
 * when a rule lives somewhere other than the default location.
 */
export const RULE_DOCUMENTATION_BASE =
  "https://github.com/anchor-os/custom-biome-lint/blob/main/docs/rules";

/**
 * Optional per-rule overrides. Keep this list easy to extend as rules are
 * added; entries here take precedence over the generated base URL.
 *
 * @type {Record<string, string>}
 */
export const RULE_DOCS = {
  // "no-native-map": "https://example.com/custom-rules/no-native-map",
};

/**
 * @param {string} rule
 * @returns {string|null}
 */
export function getRuleDocumentationUrl(rule) {
  if (rule in RULE_DOCS) {
    return RULE_DOCS[rule];
  }

  if (RULE_DOCUMENTATION_BASE.length === 0) {
    return null;
  }

  return `${RULE_DOCUMENTATION_BASE}/${rule}.md`;
}
