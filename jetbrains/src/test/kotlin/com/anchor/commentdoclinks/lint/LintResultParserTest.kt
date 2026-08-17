package com.anchor.commentdoclinks.lint

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Verifies the shared Rust -> JSON -> Kotlin contract used by the VS Code
 * extension. Mirrors test/unit/lintResultParser.test.js.
 */
class LintResultParserTest {
    private val errorDiagnostic =
        """
        {
          "rule": "no-native-map",
          "message": "Use Immutable.js Map instead of native Map.",
          "severity": "error",
          "range": { "start": { "line": 1, "column": 7 }, "end": { "line": 1, "column": 14 } }
        }
        """.trimIndent()

    @Test
    fun `empty output yields no diagnostics`() {
        assertEquals(emptyList(), CustomBiomeLintService.parseLintResult("").diagnostics)
        assertEquals(emptyList(), CustomBiomeLintService.parseLintResult("   ").diagnostics)
    }

    @Test
    fun `parses an error diagnostic`() {
        val result = CustomBiomeLintService.parseLintResult("""{ "diagnostics": [ $errorDiagnostic ] }""")
        assertEquals(1, result.diagnostics.size)
        assertEquals("no-native-map", result.diagnostics[0].rule)
        assertEquals("error", result.diagnostics[0].severity)
        assertEquals(1, result.diagnostics[0].range.start.line)
        assertEquals(7, result.diagnostics[0].range.start.column)
    }

    @Test
    fun `parses a warn diagnostic`() {
        val json = """{ "diagnostics": [ ${errorDiagnostic.replace("\"error\"", "\"warn\"")} ] }"""
        assertEquals("warn", CustomBiomeLintService.parseLintResult(json).diagnostics[0].severity)
    }

    @Test
    fun `parses a safe fix`() {
        val json =
            """
            {
              "diagnostics": [
                {
                  "rule": "no-native-map",
                  "message": "Use Immutable.js Map instead of native Map.",
                  "severity": "error",
                  "range": { "start": { "line": 1, "column": 7 }, "end": { "line": 1, "column": 14 } },
                  "fix": {
                    "kind": "safe",
                    "title": "Apply safe fix",
                    "edits": [ { "start": { "line": 1, "column": 7 }, "end": { "line": 1, "column": 14 }, "text": "Immutable.Map()" } ]
                  }
                }
              ]
            }
            """.trimIndent()
        val fix = CustomBiomeLintService.parseLintResult(json).diagnostics[0].fix
        assertNotNull(fix)
        assertEquals("safe", fix!!.kind)
        assertEquals("Immutable.Map()", fix.edits[0].text)
    }

    @Test
    fun `parses a suppression edit`() {
        val json =
            """
            {
              "diagnostics": [
                {
                  "rule": "no-native-map",
                  "message": "Use Immutable.js Map instead of native Map.",
                  "severity": "error",
                  "range": { "start": { "line": 1, "column": 0 }, "end": { "line": 1, "column": 0 } },
                  "suppression": {
                    "title": "Suppress no-native-map",
                    "edits": [ { "start": { "line": 1, "column": 0 }, "end": { "line": 1, "column": 0 }, "text": "// custom-biome-ignore-next-line no-native-map\n" } ]
                  }
                }
              ]
            }
            """.trimIndent()
        val suppression = CustomBiomeLintService.parseLintResult(json).diagnostics[0].suppression
        assertNotNull(suppression)
        assertTrue(suppression!!.edits[0].text.contains("custom-biome-ignore-next-line"))
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
    fun `missing diagnostics array throws`() {
        var threw = false
        try {
            CustomBiomeLintService.parseLintResult("{}")
        } catch (_: Exception) {
            threw = true
        }
        assertTrue(threw)
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
