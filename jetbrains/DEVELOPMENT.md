# Development

## Prerequisites

- **JDK 21** (the plugin targets WebStorm 2026.2.1, which ships Kotlin metadata 2.4.0).
  - macOS (arm64): `/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
- **Gradle** — use the project wrapper (`./gradlew`), no separate install needed. Current wrapper: Gradle 9.7.0.
- **Kotlin** 2.4.0 and **IntelliJ Platform Gradle Plugin** 2.18.1 are pinned in `build.gradle.kts`.

## Environment (macOS)

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
cd jetbrains
```

## Common tasks

| Task | Command | Output |
|---|---|---|
| Build plugin ZIP | `./gradlew buildPlugin` | `build/distributions/comment-doc-links-jetbrains-0.1.3.zip` |
| Run tests | `./gradlew test` | 97 tests |
| Launch IDE sandbox | `./gradlew runIde` | WebStorm instance with plugin installed |
| Verify compatibility | `./gradlew verifyPlugin` | Marketplace compatibility report |
| Sign (token) | `./gradlew signPlugin` | signs the built distribution in place |
| Publish | `./gradlew publishPlugin` | uploads to Marketplace (needs token) |
| Check formatting | `./gradlew spotlessCheck` | ktlint (Kotlin) — fails on unformatted code |
| Auto-format | `./gradlew spotlessApply` | reformats `src/**/*.kt` to ktlint style |

> The Gradle wrapper `distributionSha256Sum` is pinned, so the first `./gradlew`
> run verifies the distribution hash.

## Project layout

 ```text
jetbrains/
├── build.gradle.kts
├── gradle.properties            # JVM args, build cache, configuration cache
├── gradle/wrapper/              # pinned Gradle wrapper
├── src/main/kotlin/com/anchor/commentdoclinks/   # plugin source
├── src/main/resources/META-INF/plugin.xml        # extension points
├── src/test/kotlin/com/anchor/commentdoclinks/   # 97 tests
└── *.md                         # this documentation set
```

## Coding conventions

- **Pure core first.** Keep parsing/resolution logic free of IntelliJ APIs so it
  is directly testable. Put IntelliJ-only concerns in `services/` or the EP
  implementations.
- **Expose pure functions** for anything a test would need (e.g.
  `markdownSourceDiagnostics`, `suggestDocAnchorCompletions`); the EP classes are
  thin wrappers that call them.
- **VS Code is the behavioral source of truth.** When behavior is ambiguous,
  match `src/parsers/languageSupport.js`, `src/services/anchorResolver.js`,
  `src/services/referenceValidator.js`, etc. exactly. Document any deliberate
  deviation in `IMPLEMENTATION_STATUS.md` and `BEHAVIOR_SPEC.md`.
- **Don't touch `src/`** (VS Code), `package.json`, or the VS Code CI workflows.
- Kotlin style: 4-space indent, `data class` models, explicit `when` on enums
  (enforced by ktlint via `spotlessCheck`/`spotlessApply`).

## Adding a supported language

1. Add the extension → language mapping in `LanguageSupport.EXTENSION_TO_LANGUAGE`.
2. Add the language to `SUPPORTED_LANGUAGES` and a `COMMENT_STYLE` entry.
3. If the comment syntax is new, add a `getXxxCommentRanges` function (stateful,
   reusing `CommentScannerState` across lines).

## Debugging

- `./gradlew runIde` launches a sandbox WebStorm. Open a project containing both
  source files and a linked markdown doc to exercise forward/reverse navigation.
- Broken-reference diagnostics and highlighting appear live as you type (driven by
  `CommentDocLinkAnnotator`).
