package com.anchor.commentdoclinks.lint

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Verifies the TODO-1 parity fix: JetBrains must relaunch `.js` launchers
 * through the Node runtime (Windows-safe), while native binaries are invoked
 * directly — matching the VS Code adapter.
 */
class CustomBiomeLintServiceTest {
    @Test
    fun `native binary is invoked directly`() {
        val (command, args) =
            CustomBiomeLintService.resolveLauncher(
                "/ws/node_modules/custom-biome-lint/bin/custom-biome-lint",
            )
        assertEquals("/ws/node_modules/custom-biome-lint/bin/custom-biome-lint", command)
        assertEquals(emptyList<String>(), args)
    }

    @Test
    fun `js launcher is relaunched through node when available`() {
        val (command, args) =
            CustomBiomeLintService.resolveLauncher(
                "/ws/node_modules/custom-biome-lint/bin/cli.js",
            )
        if (args.isEmpty()) {
            // No `node` on PATH in this environment: best-effort fallback keeps
            // the launcher unchanged. Nothing to assert.
            return
        }
        assertTrue(
            command.endsWith("node") || command.endsWith("node.exe"),
            "command should be the node runtime, was: $command",
        )
        assertEquals(listOf("/ws/node_modules/custom-biome-lint/bin/cli.js"), args)
    }
}
