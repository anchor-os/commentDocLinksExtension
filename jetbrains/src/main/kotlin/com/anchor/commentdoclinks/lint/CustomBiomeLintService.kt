package com.anchor.commentdoclinks.lint

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.CapturingProcessHandler
import kotlinx.serialization.json.Json
import java.io.File
import java.util.Optional
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

/**
 * Detection + execution of the optional `custom-biome-lint` package.
 *
 * The lint feature is OPTIONAL: it activates only when the binary can be
 * resolved. Resolution first walks up from the file looking for
 * `node_modules/custom-biome-lint` (closest to the file — supports
 * npm/yarn/pnpm and monorepos), then falls back to `custom-biome-lint` on the
 * system PATH (per the v1 protocol contract). The install root is also the
 * directory whose `package.json` (`ignoreBiomeExtensionRules`) the Rust
 * linter reads.
 *
 * Detection results are cached per start directory; [clearCache] drops them
 * (used on a workspace refresh).
 */
object CustomBiomeLintService {
    data class Install(
        val packageDir: String,
        val workspaceDir: String,
        val executable: String,
    )

    private val cache = ConcurrentHashMap<String, Optional<Install>>()

    /** Resolve (and cache) the install for a file's workspace. */
    fun findInstall(startPath: String): Install? {
        cache[startPath]?.let { return it.orElse(null) }

        var dir = File(startPath).absoluteFile
        if (dir.isFile) dir = dir.parentFile ?: dir

        while (true) {
            val candidate = File(dir, "node_modules/custom-biome-lint")
            val pkgFile = File(candidate, "package.json")
            if (pkgFile.isFile) {
                val executable = resolveExecutable(candidate)
                val install =
                    if (executable != null) {
                        Install(candidate.absolutePath, dir.absolutePath, executable)
                    } else {
                        null
                    }
                cache[startPath] = Optional.ofNullable(install)
                return install
            }

            val parent = dir.parentFile ?: break
            dir = parent
        }

        // Fall back to a binary on the system PATH (v1 contract default).
        val pathExecutable = resolveOnPath("custom-biome-lint")
        if (pathExecutable != null) {
            val install = Install(pathExecutable, File(startPath).absoluteFile.parent
                ?: ".", pathExecutable)
            cache[startPath] = Optional.ofNullable(install)
            return install
        }

        cache[startPath] = Optional.empty()
        return null
    }

    /** Read the package's `bin` and verify the binary exists. */
    private fun resolveExecutable(packageDir: File): String? {
        val pkgFile = File(packageDir, "package.json")
        val json =
            try {
                Json.parseToJsonElement(pkgFile.readText())
            } catch (_: Exception) {
                return null
            }

        val obj = json as? kotlinx.serialization.json.JsonObject ?: return null
        val binRelative =
            when (val bin = obj["bin"]) {
                is kotlinx.serialization.json.JsonPrimitive -> bin.content
                is kotlinx.serialization.json.JsonObject -> {
                    val inner = bin["custom-biome-lint"]
                    (inner as? kotlinx.serialization.json.JsonPrimitive)?.content
                        ?: bin.entries.firstOrNull()?.value?.let {
                            (it as? kotlinx.serialization.json.JsonPrimitive)?.content
                        }
                }
                else -> null
            } ?: "bin/custom-biome-lint"

        val executable = File(packageDir, binRelative)
        return if (executable.isFile) executable.absolutePath else null
    }

    /** Resolve an executable name against the system PATH; null if absent. */
    private fun resolveOnPath(name: String): String? {
        val path = System.getenv("PATH") ?: return null
        for (dir in path.split(File.pathSeparator)) {
            val candidate = File(dir, name)
            if (candidate.isFile && candidate.canExecute()) return candidate.absolutePath
        }
        return null
    }

    fun clearCache() = cache.clear()

    /** Raised when the linter fails to run (missing binary, timeout, crash). */
    class LintExecutionException(message: String) : Exception(message)

    /**
     * Run the linter in live-buffer (stdin) mode and parse its JSON stdout.
     *
     * Preferred per the v1 contract: `echo "<buffer>" | custom-biome-lint
     * --stdin <virtual-path> --format json`. The `<virtual-path>` is used for
     * extension filtering + display only; the on-disk file is NOT read, so
     * unsaved edits are linted. The on-disk file path need not exist.
     */
    fun runLint(
        executable: String,
        virtualPath: String,
        cwd: String,
        buffer: String,
    ): LintResult {
        val commandLine =
            GeneralCommandLine(executable, "--stdin", virtualPath, "--format", "json")
                .withWorkDirectory(cwd)
                .withRedirectErrorStream(false)

        val handler = CapturingProcessHandler(commandLine)
        val stdinThread =
            thread(name = "custom-biome-lint-stdin") {
                try {
                    handler.processInput.bufferedWriter(Charsets.UTF_8).use { it.write(buffer) }
                } catch (_: Exception) {
                    // Process may have exited before consuming all input.
                }
            }
        val output = handler.runProcess(30_000, true)
        stdinThread.join(2_000)

        if (output.isTimeout) {
            throw LintExecutionException("custom-biome-lint timed out after 30s")
        }

        val stdout = output.stdout
        if (stdout.isBlank()) {
            val stderr = output.stderr.trim()
            if (stderr.isNotBlank()) throw LintExecutionException(stderr)
            return LintResult(files = emptyList())
        }

        return parseLintResult(stdout)
    }

    /** Parse raw stdout JSON into a [LintResult] (v1 envelope). */
    fun parseLintResult(json: String): LintResult {
        if (json.isBlank()) return LintResult(files = emptyList())
        return JSON_FORMAT.decodeFromString<LintResult>(json)
    }

    private val JSON_FORMAT =
        Json {
            ignoreUnknownKeys = true
            isLenient = true
        }
}
