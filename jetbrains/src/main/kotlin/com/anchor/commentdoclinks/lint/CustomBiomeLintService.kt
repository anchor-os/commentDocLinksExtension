package com.anchor.commentdoclinks.lint

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import java.io.File

/**
 * Detection + execution of the optional `custom-biome-lint` package.
 *
 * The lint feature is OPTIONAL: it activates only when the package is
 * installed inside the workspace (`node_modules/custom-biome-lint`). The
 * install root is the directory closest to the file, which is also the
 * directory whose `package.json` (`ignoreBiomeExtensionRules`) the Rust
 * linter reads — this supports npm/yarn/pnpm and monorepos naturally.
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

    private val cache = mutableMapOf<String, Install?>()

    /** Resolve (and cache) the install for a file's workspace. */
    fun findInstall(startPath: String): Install? {
        cache[startPath]?.let { return it }

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
                cache[startPath] = install
                return install
            }

            val parent = dir.parentFile ?: break
            dir = parent
        }

        cache[startPath] = null
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

        val binRelative =
            when (val bin = json.jsonObject["bin"]) {
                is JsonPrimitive -> bin.content
                is JsonObject -> {
                    bin["custom-biome-lint"]?.jsonPrimitive?.content
                        ?: bin.entries.firstOrNull()?.value?.jsonPrimitive?.content
                }
                else -> null
            } ?: "bin/custom-biome-lint"

        val executable = File(packageDir, binRelative)
        return if (executable.isFile) executable.absolutePath else null
    }

    fun clearCache() = cache.clear()

    /** Run the linter and parse its JSON stdout. */
    fun runLint(
        executable: String,
        file: String,
        cwd: String,
    ): LintResult {
        val process =
            ProcessBuilder(executable, file, "--format", "json")
                .directory(File(cwd))
                .redirectErrorStream(false)
                .start()
        val stdout = process.inputStream.bufferedReader().readText()
        process.waitFor()
        return parseLintResult(stdout)
    }

    /** Parse raw stdout JSON into a [LintResult]. */
    fun parseLintResult(json: String): LintResult {
        if (json.isBlank()) return LintResult(emptyList())
        return JSON_FORMAT.decodeFromString<LintResult>(json)
    }

    private val JSON_FORMAT =
        Json {
            ignoreUnknownKeys = true
            isLenient = true
        }
}
