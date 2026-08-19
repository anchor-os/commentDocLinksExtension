package com.anchor.commentdoclinks.lint

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Verifies the v1 Rust -> JSON -> Kotlin contract (files[].violations[]).
 * Mirrors the binary's own tests/ide_contract.rs.
 */
class LintResultParserTest {
    private val errorViolation =
        """
        {
          "rule": "no-native-map",
          "message": "Use Immutable.js Map instead of native Map.",
          "severity": "error",
          "line": 1, "col": 15,
          "startLine": 1, "startColumn": 15,
          "endLine": 1, "endColumn": 18
        }
        """.trimIndent()

    @Test
    fun `empty output yields no files`() {
        assertEquals(emptyList(), CustomBiomeLintService.parseLintResult("").files)
        assertEquals(emptyList(), CustomBiomeLintService.parseLintResult("   ").files)
    }

    @Test
    fun `parses an error violation from the v1 envelope`() {
        val json =
            """{ "version": 1, "files": [ { "path": "src/foo.js", "violations": [ $errorViolation ] } ],
                 "summary": { "errors": 1, "warnings": 0, "filesWithViolations": 1, "filesChecked": 1,
                              "filesCacheSkipped": 0, "elapsedMs": 3, "clean": false } }"""
        val result = CustomBiomeLintService.parseLintResult(json)
        assertEquals(1, result.version)
        assertEquals(1, result.files.size)
        val v = result.files[0].violations[0]
        assertEquals("src/foo.js", result.files[0].path)
        assertEquals("no-native-map", v.rule)
        assertEquals("error", v.severity)
        assertEquals(1, v.startLine)
        assertEquals(15, v.startColumn)
        assertEquals(1, v.endLine)
        assertEquals(18, v.endColumn)
        assertNotNull(result.summary)
        assertEquals(1, result.summary!!.errors)
        assertEquals(false, result.summary!!.clean)
    }

    @Test
    fun `parses a warning severity`() {
        val json =
            """{ "version": 1, "files": [ { "path": "a.js", "violations": [
                 ${errorViolation.replace("\"error\"", "\"warning\"")} ] } ] }"""
        val v = CustomBiomeLintService.parseLintResult(json).files[0].violations[0]
        assertEquals("warning", v.severity)
    }

    @Test
    fun `parses plural fixes and suppressions with replacement edits`() {
        val json =
            """
            {
              "version": 1,
              "files": [ { "path": "src/foo.js", "violations": [
                {
                  "rule": "no-native-map",
                  "message": "Use Immutable.js Map instead of native Map.",
                  "severity": "error",
                  "line": 1, "col": 7,
                  "startLine": 1, "startColumn": 7,
                  "endLine": 1, "endColumn": 14,
                  "fixes": [
                    { "kind": "safe", "title": "Apply safe fix",
                      "edits": [ { "startLine": 1, "startColumn": 7, "endLine": 1, "endColumn": 14,
                                   "replacement": "Immutable.Map()" } ] }
                  ],
                  "suppressions": [
                    { "kind": "suppress", "title": "Suppress no-native-map",
                      "edits": [ { "startLine": 1, "startColumn": 21, "endLine": 1, "endColumn": 21,
                                   "replacement": " // custom-biome-ignore-line no-native-map" } ] }
                  ]
                }
              ] } ]
            }
            """.trimIndent()
        val v = CustomBiomeLintService.parseLintResult(json).files[0].violations[0]
        assertEquals(1, v.fixes.size)
        assertEquals("safe", v.fixes[0].kind)
        assertEquals("Immutable.Map()", v.fixes[0].edits[0].replacement)
        assertEquals(1, v.suppressions.size)
        assertEquals("suppress", v.suppressions[0].kind)
        assertTrue(v.suppressions[0].edits[0].replacement.contains("custom-biome-ignore-line"))
    }

    @Test
    fun `tolerates line-only violations missing endLine endColumn`() {
        val json =
            """
            {
              "version": 1,
              "files": [ { "path": "a.js", "violations": [
                {
                  "rule": "some-line-rule",
                  "message": "Line-level issue.",
                  "severity": "warning",
                  "line": 3, "col": 1,
                  "startLine": 3, "startColumn": 1
                }
              ] } ]
            }
            """.trimIndent()
        val v = CustomBiomeLintService.parseLintResult(json).files[0].violations[0]
        assertEquals(3, v.startLine)
        assertEquals(1, v.startColumn)
        assertNull(v.endLine)
        assertNull(v.endColumn)
        assertTrue(v.fixes.isEmpty())
        assertTrue(v.suppressions.isEmpty())
    }

    @Test
    fun `invalid json throws`() {
        var threw = false
        try {
            CustomBiomeLintService.parseLintResult("{ not json")
        } catch (_: Exception) {
            threw = true
        }
        assertTrue(threw)
    }

    @Test
    fun `valid but empty envelope parses to no violations`() {
        // All fields have defaults, so a bare object is a clean (no-op) result.
        val result = CustomBiomeLintService.parseLintResult("""{ "version": 1, "files": [] }""")
        assertEquals(emptyList(), result.files)
    }

    @Test
    fun `documentation url is derived from the rule`() {
        assertEquals(
            "https://github.com/anchor-os/custom-biome-lint/blob/main/docs/rules/no-native-map.md",
            RuleDocumentation.urlFor("no-native-map"),
        )
        assertFalse(RuleDocumentation.urlFor("no-native-map").isNullOrBlank())
    }
}
