package com.anchor.commentdoclinks.lint

/**
 * Central, single-source mapping from a rule id to its documentation URL.
 *
 * URLs are intentionally NOT hardcoded at call sites. Add a rule here (or
 * change [BASE]) and every surface that links to docs picks it up. The Rust
 * linter may also supply a per-diagnostic `docsUrl` which wins over this map.
 */
object RuleDocumentation {
    private const val BASE = "https://github.com/anchor-os/custom-biome-lint/blob/main/docs/rules"

    /** Optional per-rule overrides. Extend this list as rules are added. */
    private val OVERRIDES: Map<String, String> = emptyMap()

    fun urlFor(rule: String): String? = OVERRIDES[rule] ?: "$BASE/$rule.md"
}
