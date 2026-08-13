plugins {
    id("org.jetbrains.intellij.platform") version "2.18.1"
    id("org.jetbrains.kotlin.jvm") version "2.4.0"
    id("com.diffplug.spotless") version "8.9.0"
}

import org.jetbrains.intellij.platform.gradle.TestFrameworkType

group = "com.anchor"
version = "0.1.3"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        webstorm("2026.2.1")
        pluginVerifier()
        zipSigner()
        testFramework(TestFrameworkType.Platform)
    }

    testImplementation(kotlin("test"))
    testImplementation("org.junit.vintage:junit-vintage-engine")
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
}

intellijPlatform {
    pluginConfiguration {
        version = project.version.toString()
        name = "Comment Doc Links"
        id = "com.anchor.commentdoclinks"

        description = """
            Navigate between source comments and markdown documentation with two-way links.
            (getanchor.io)
        """.trimIndent()

        vendor {
            name = "getanchor.io"
            email = ""
            url = "https://github.com/anchor-os/commentDocLinksExtension"
        }
    }

    // Publishing + signing are configured from environment variables / project
    // properties so that the normal `build`/`test` tasks never require secrets.
    // `publishPlugin` / `signPlugin` only read these when actually executed.
    // Signing uses the JetBrains Marketplace token (Marketplace signature API),
    // so no separate code-signing certificate is required.
    publishing {
        token = providers.environmentVariable("JETBRAINS_MARKETPLACE_TOKEN")
        channels = providers.environmentVariable("JETBRAINS_MARKETPLACE_CHANNELS")
            .orElse("default")
            .map { it.split(',').map { c -> c.trim() }.filter { c -> c.isNotEmpty() } }
    }
}

// Kotlin formatting/linting for the plugin source (Biome only covers JS/TS).
// `spotlessCheck` fails the build on unformatted code; `spotlessApply` fixes it.
spotless {
    kotlin {
        target("src/**/*.kt")
        ktlint()
    }
}