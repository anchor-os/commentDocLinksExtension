# Implementation Status

## Overall

The JetBrains / WebStorm port of **Comment Doc Links** is **complete and
shipping-ready**.

- Builds cleanly: `build/distributions/comment-doc-links-jetbrains-0.1.3.zip`
- **97 unit tests** passing via `./gradlew test`
- `verifyPlugin` reports **Compatible** on WebStorm 2026.2.1 (WS-262.9437.145), 0 defects
- Independent of the VS Code extension (no Gradle↔npm coupling)

## What is implemented

| Area | Status | Notes |
|---|---|---|
| Reference parsing (`parser/ReferenceParser`) | ✅ | Doc (`file.md`, `:42`, `#L42`, `#anchor`, ` — anchor`), `#123`, `API:Foo`, `DOC-123` |
| Language/comment detection (`parser/LanguageSupport`) | ✅ | 20 languages; slash/hash/yaml/terraform/graphql/velocity/php/wholeLine scanners |
| Document scan (`parser/DocumentScanner`) | ✅ | single shared scan consumed by all features |
| Anchor resolution (`resolver/AnchorResolver`) | ✅ | explicit → HTML → slugified; duplicate-suffix logic |
| Path resolution (`resolver/PathResolution`) | ✅ | git-root, worktree gitfile, escape rejection, `relativize` safety |
| Reference validation (`resolver/ReferenceValidator`) | ✅ | all 6 `ResolutionStatus` values + messages |
| Reverse navigation (`resolver/SourceReferenceResolver`) | ✅ | doc heading → source comment line |
| IntelliJ boundary (`services/`) | ✅ | `VfsFileSystem`, `WorkspaceRootService` (cached), `DocumentAdapters` |
| Forward navigation (`navigation/CommentDocReference*`) | ✅ | Ctrl/Cmd+Click, Go-to-Declaration |
| Reverse navigation (`navigation/MarkdownSource*`) | ✅ | `## src/file.js — anchor` links |
| Decorations + diagnostics (`decorations/CommentDocLinkAnnotator`) | ✅ | link color; ERROR/WARNING gated by config |
| Completion (`completion/ReferenceCompletionContributor`) | ✅ | doc anchors + source anchors |
| Config (`config/CommentDocLinksConfig`) | ✅ | `commentDocLinks.*` keys, defaults enabled |
| CI build + artifact (`.github/workflows/jetbrains-ci.yml`) | ✅ | runs `test buildPlugin` on `jetbrains/**` |
| CI publish (`.github/workflows/jetbrains-publish.yml`) | ✅ | manual `workflow_dispatch`, tag-validated |
| Token-based signing | ✅ | `publishing { token }` only; no cert required |
| Configuration cache | ✅ | enabled in `gradle.properties` (verified with `buildPlugin` + `test`) |

## Phases

All planned phases (0–23) are complete: repo audit → architecture → bootstrap →
pure core (parser/resolver) → IntelliJ boundary → navigation/decorations →
completion → config → reverse navigation → test suite → parity matrix →
performance → packaging/compatibility → CI/CD → docs → final review.

## Build toolchain

- JDK 21 (`/opt/homebrew/opt/openjdk@21`)
- Gradle 9.7.0 (wrapper, `distributionSha256Sum` pinned)
- Kotlin JVM 2.4.0
- IntelliJ Platform Gradle Plugin 2.18.1
- Target: `webstorm("2026.2.1")`
- Kotlin 2.4.0 is **required** (WebStorm 2026.2.1 ships Kotlin metadata 2.4.0)

## Known decisions / invariants

- VS Code `src/` is the behavioral source of truth; port 1:1 (see `PARITY_MATRIX.md`).
- `#42` is a heading anchor, **not** a line reference.
- Line numbers 1-based for users; IntelliJ internals 0-based.
- `.git` may be a directory (checkout) or a file (worktree gitfile).
- Root = deepest git checkout root containing the referencing document.
- Issue/API/`DOC-…` references are external (info, never broken diagnostics).
- Plugin never scans the whole workspace — only open + referenced documents.

## Known gaps

- No live IntelliJ fixture tests for the EP classes (covered via pure-function tests).
- No settings UI / color settings page (config persisted, not surfaced in Preferences).
- `linkColor` / `linkUnderline` config keys accepted but not yet wired into the highlighter.

## Known bugs

- None.

## Behavioral deviations from VS Code

- **`API & Errors` slug:** VS Code's regex yields `api--errors` (two spaces → two
  `-`); the Kotlin port matches the VS Code code exactly, so existing anchors stay
  resolvable. Documented in `BEHAVIOR_SPEC.md` §7.
