# JetBrains Plugin Implementation Status

## Overall Status

Phases 0–16 — Complete. Plugin builds (`build/libs/comment-doc-links-jetbrains-0.1.3.jar`) with **96 unit tests passing**.

## Completed

- [x] Phase 0 — Create persistent project state
- [x] Phase 16 — Behavioral parity matrix: `jetbrains/PARITY_MATRIX.md` rewritten to the prompt's required `Feature | VS Code | JetBrains | Test` format. 24 features marked ✅ (proven by tests), 3 marked 🟡 (implemented; Psi glue not unit-tested due to light-fixture EP limitation, logic proven by pure-function tests), 0 ⬜. Added missing line-resolution edge-case tests (first/last/beyond-EOF/0/negative + anchor+line precedence) to `ReferenceValidatorTest` so `#L42`/`#42`/`:42`/line-diagnostics are fully proven.
- [x] Phase 17 — Performance review + fixes. No repo-wide scans (single-document only). Two EDT hot-spots fixed: (1) `WorkspaceRootService` now caches resolved root per document path in project user data, avoiding repeated `.git` directory walks on every annotator/completion pass; (2) `markdownSourceDiagnostics` memoizes source-file reads per pass (one VFS read per referenced source file instead of N). `VfsFileSystem` already uses VFS (in-memory) reads, no blocking disk I/O.
- [x] Phase 18 — Packaging + compatibility. `./gradlew buildPlugin` produces `build/distributions/comment-doc-links-jetbrains-0.1.3.zip`. `verifyPlugin` reports **Compatible** against WS-262.9437.145 (WebStorm 2026.2.1) with **0 defects**. Removed the unnecessary optional `org.jetbrains.markdown` `<depends>` (markdown is detected by language ID, not the module API) which eliminated a config-file verification defect. `plugin.xml` has correct id `com.anchor.commentdoclinks`, name, vendor, and `com.intellij.modules.platform` dependency.
- [x] Phase 19 — CI/CD architecture extended without touching VS Code CI. Added two isolated workflows: `jetbrains-ci.yml` (build/test/package on push+PR for `jetbrains/**`) and `jetbrains-publish.yml` (manual/release-only publish). `ci.yml`/`publish.yml`/`publish-openvsx.yml` left unchanged; no Gradle↔npm coupling.
- [x] Phase 20 — JetBrains CI build job: `.github/workflows/jetbrains-ci.yml` checks out, sets up JDK 21 (temurin, Gradle cache), enters `jetbrains/`, runs `./gradlew buildPlugin` (build + 96 tests), and uploads `build/distributions/*.zip` as an artifact. Initially builds + uploads only (no publish).
- [x] Phase 21 — JetBrains Marketplace publishing configured, separate from VS Code/Open VSX. `build.gradle.kts` gained `signing { }` + `publishing { }` blocks reading `JETBRAINS_MARKETPLACE_TOKEN` / `JETBRAINS_MARKETPLACE_CHANNELS` / signing secrets from env vars (no secrets in repo; normal `build` unaffected). `jetbrains-publish.yml` triggers only on a GitHub Release or manual dispatch and runs `./gradlew buildPlugin publishPlugin`. Publishing is never automatic.
- [x] Phase 22 — Documentation updated. Root `README.md` gained an **Editions** section (VS Code `src/` vs JetBrains `jetbrains/`, isolated builds) and lists WebStorm/IntelliJ as a supported requirement. `BEHAVIOR_SPEC.md`, `PARITY_MATRIX.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_STATUS.md` already document the spec, parity, architecture, and publishing.
- [x] Phase 23 — Final review complete. Checklist: VS Code `src/` untouched; `jetbrains/` isolated and independently buildable; no generated files or secrets committed; `Gradle build` passes (96 tests); plugin ZIP generated and verifies **Compatible** on WebStorm 2026.2.1; CI build + artifact upload jobs present; README/parity/architecture/spec docs present. `runIde` task available for local dev launch (not runnable headless here).
- [x] Phase 10 — Completion implemented: `completion/ReferenceCompletionContributor.kt` (`CompletionContributor`) suggests doc-file anchors after `file.md#` in supported comments and source anchors after `## src/file.js — ` in Markdown headings, mirroring `src/completion/completionProvider.js`. Pure logic extracted to `suggestDocAnchorCompletions` / `suggestSourceAnchorCompletions`.
- [x] Phase 11 — Config implemented: `config/CommentDocLinksConfig.kt` exposes `commentDocLinks.*` keys (enableDecorations, linkColor, linkUnderline, enableDiagnostics, enableCompletion) with defaults = true and `setValue(name, value.toString())` persistence. Settings registered in `plugin.xml`; read in annotator (gated by enableDiagnostics/enableDecorations) and completion (gated by enableCompletion).
- [x] Phase 12 — Reverse navigation + Markdown source-reference diagnostics implemented: `navigation/MarkdownSourceReference.kt` + `navigation/MarkdownSourceLinkContributor.kt` (attach `MarkdownSourceReference` to the `src/file.js` span in `## src/file.js — anchor` headings; `resolve()` opens the source file at the commenting line via `resolveSourceReference`). `decorations/CommentDocLinkAnnotator.kt` extended with `annotateMarkdownSourceReferences` → pure `markdownSourceDiagnostics` (ERROR when source file missing, WARNING when source anchor missing).
- [x] Phase 13 — Test suite extended to cover Phases 10–12 via pure-function extraction (IntelliJ light-test fixture does NOT invoke plugin `annotator`/`referenceContributor`/`completion.contributor` extensions via `doHighlighting()`/`findReferenceAt`/`complete`, so logic is tested directly with a `FakeFileSystem : FileSystemLike`). Added `CommentDocLinksConfigTest`, `ReferenceCompletionContributorTest`, `CommentDocLinkAnnotatorTest`, `MarkdownSourceLinkContributorTest`; `junit-vintage-engine` + `testFramework(TestFrameworkType.Platform)` wired in `build.gradle.kts`. `plugin.xml` markdown dependency made optional. 89 tests pass.
- [x] Phase 14 — `jetbrains/PARITY_MATRIX.md` created (every VS Code module → Kotlin module + status).
- [x] Phase 15 — Status report written (this file, up to date).
- [x] Phase 1 — Full repository audit; `jetbrains/BEHAVIOR_SPEC.md` produced
- [x] Phase 2 — Architecture designed; `jetbrains/ARCHITECTURE.md` produced
- [x] Phase 3 — Bootstrap minimal valid plugin; `./gradlew build` passes; `runIde`/`verifyPlugin` tasks present; composed JAR produced at `build/libs/comment-doc-links-jetbrains-0.1.3.jar`
- [x] Phase 4 — Pure core `model/` + `parser/ReferenceParser.kt` implemented; 23 unit tests pass (regex parity incl. absolute-path/URL/Windows-path rejection, `#42`-is-anchor, line forms, ticket/issue/api, offset). Test harness (`kotlin-test` + JUnit5) added.
- [x] Phase 5 — Pure resolver core implemented + tests: `model/DocumentLike.kt`, `resolver/LineCounter.kt`, `resolver/MarkdownParser.kt` (`parseMarkdownHeading`), `resolver/AnchorResolver.kt` (`markdownSlug`, `resolveAnchor`, `listAnchors`, duplicate-suffix logic), `resolver/PathResolution.kt` (NIO-backed `resolveInRoot`, `findCheckoutRoot`, `chooseRoot`, `hasGitEntry` worktree gitfile, `workspaceRelativePath`). 49 total tests pass.
- [x] Phase 6 — Pure core complete + tested: `parser/LanguageSupport.kt` (SUPPORTED_LANGUAGES, COMMENT_STYLE, EXTENSION_TO_LANGUAGE, `getCommentRanges` state machine for slash/hash/yaml/terraform/graphql/velocity/php/wholeLine), `parser/DocumentScanner.kt` (`scanDocumentForReferences(document, languageId)`), `resolver/ReferenceValidator.kt` (`validateReference`, `FileSystemLike`, exact §9 messages), `resolver/SourceReferenceResolver.kt` (`resolveSourceReference`, `hasExactSourceReference`, `listSourceAnchors`, `normalizedFile` strips `./`). 65 total tests pass (23+26+7+9). `LanguageSupport` stateful scanner reused across lines via `CommentScannerState`.
- [x] Phase 7 — IntelliJ `services/` layer complete + compiles in plugin build: `services/DocumentAdapters.kt` (`documentLikeFromDocument`, `languageIdFromVirtualFile`), `services/VfsFileSystem.kt` (`VfsFileSystem : FileSystemLike` over `LocalFileSystem`), `services/WorkspaceRootService.kt` (`resolveWorkspaceRoot`, `workspaceRelativePath`). `./gradlew build` passes; the service is a thin IntelliJ-boundary wrapper over the pure `chooseRoot`/`findCheckoutRoot`/`workspaceRelativePath`/`resolveInRoot` core.
- [x] Phase 8 — Navigation + decorations complete, `./gradlew build` passes:
  - `navigation/CommentDocReference.kt` — `CommentDocReference : PsiReferenceBase` whose `resolve()` validates the reference, opens the target doc via `VfsFileSystem`+`resolveInRoot`, and returns the PsiElement at the 1-based line (line refs) or markdown anchor line (`resolveAnchor`), or the target PsiFile; external/missing/invalid resolve to null.
  - `navigation/CommentDocReferenceContributor.kt` — `PsiReferenceContributor` registered on `PlatformPatterns.psiFile()`, scans the document once per file and attaches `CommentDocReference`s (file-relative ranges) for supported languages. Reference is clickable (Ctrl/Cmd+Click) and Go-to-Declaration works.
  - `decorations/CommentDocLinkAnnotator.kt` — `Annotator` (language `ANY`) colors references by `ResolutionStatus`: VALID + EXTERNAL → link color (`LINK_KEY`, inherits `DOC_COMMENT_TAG_VALUE`); MISSING_FILE/INVALID_PATH → ERROR with §9 message; MISSING_ANCHOR/INVALID_LINE → WARNING with §9 message. Registered in `plugin.xml`.
  - Phase 9 (broken-reference diagnostics) is delivered by the same annotator (WARNING/ERROR on broken spans), so Phase 9 is effectively complete.

## Current Phase

Complete — all Phases 0–15 done. Plugin builds and 89 tests pass.

## Current Task

None pending. All planned phases delivered.

## Next Task

(None — phases complete. Possible future follow-ups: richer integration/UI tests via a full `LoadedPluginDescriptor` fixture, additional config UI, or `pluginVerification` wiring in IPGP 2.18.1.)

## Behavioral Deviations Noted

- **Slug of `API & Errors`**: the VS Code `markdownSlug` regex produces `api--errors` (removing `&` leaves two spaces, each turned into `-`), NOT `api-errors` as the BEHAVIOR_SPEC §7 prose loosely states. The Kotlin port matches the actual VS Code code (regex-faithful), so existing anchors stay resolvable. Documented as a spec-vs-code nuance.

## Known Decisions

- Build toolchain: JDK 21 (`/opt/homebrew/opt/openjdk@21`), Gradle 9.7.0 wrapper, Kotlin JVM 2.4.0, IPGP `org.jetbrains.intellij.platform` 2.18.1, target `webstorm("2026.2.1")`. Kotlin 2.4.0 is REQUIRED (WebStorm 2026.2.1 ships Kotlin metadata 2.4.0; 2.2.20 fails with incompatible metadata). `pluginVerification` block removed (its `ides.ide(...)`/`ides.webstorm(...)` DSL is not exposed in 2.18.1); can revisit later.
- The existing VS Code extension, its tests, and `docs/` are the behavioral source of truth; do not invent behavior.
- `#42` is NOT a line reference; it is a heading anchor. Only `:42`, `#L42`, `#l42` are line references.
- Line numbers are 1-based for users; IntelliJ internal APIs are 0-based (convert `-1` on reveal/validate).
- `.git` handling must treat it as a directory (main checkout) OR a file (linked worktree gitfile); never assume a directory.
- Root selection = deepest git checkout root (or workspace folder) that contains the referencing document.
- Issue/API/DOC-… references are external: not locally resolvable, shown as info, not broken diagnostics.
- Missing/overlapping span priority: documentation reference wins over issue/ticket/API forms.
- No quick fixes / code actions exist in the VS Code extension — do not invent them.
- Decoration color mapping: valid+external = link color; missing-file/invalid-path = error; missing-anchor/invalid-line = warning.
- Diagnostics are Warning severity on the full reference span; only proven-broken references are reported (unreadable files skipped).
- Extension never enumerates the whole workspace for scanning; matches open + referenced documents only.

## Known Compatibility Requirements

- Plugin must be compatible with WebStorm and other IntelliJ-based IDEs.
- Must NOT depend on the VS Code build (no Gradle↔npm coupling).
- Must keep the existing VS Code implementation untouched.
- Two independent artifacts: VS Code VSIX (existing) + JetBrains plugin ZIP.

## Known Bugs

- (none yet)

## Tests Added

- `parser/ReferenceParserTest.kt` — 23 tests (regex parity, offsets, line forms `#L42`/`#l42`/`:42`/`#42`-is-anchor).
- `resolver/LineCounterTest.kt`, `resolver/MarkdownParserTest.kt`, `resolver/AnchorResolverTest.kt`, `resolver/PathResolutionTest.kt` — 26 tests (slug, anchor resolution order, duplicate suffixes, worktree `.git` gitfile, root selection, escape rejection).
- `parser/DocumentScannerTest.kt` — 7 tests (language guard, comment-only detection, string-literal skip, line offset, per-line line number, combined issue+doc, markdown whole-line).
- `resolver/SourceReferenceResolverTest.kt` — 9 tests (exact-anchor win, file-only fallback, top-of-doc fallback, `./` normalization, hasExact true/false/empty, dedup anchors, ignore non-doc refs).
- `resolver/ReferenceValidatorTest.kt` — 16 tests: EXTERNAL, INVALID_PATH, MISSING_FILE, MISSING_ANCHOR, VALID (plain/anchor/line), INVALID_LINE (out-of-range/0/negative/beyond-EOF), unreadable-tolerant, line-vs-anchor precedence.
- `config/CommentDocLinksConfigTest.kt` — defaults + `setValue(name, value.toString())` persistence.
- `completion/ReferenceCompletionContributorTest.kt` — `suggestDocAnchorCompletions` (after `#`), `suggestSourceAnchorCompletions` (after `## src/file.js — `); no-suggestion guards.
- `decorations/CommentDocLinkAnnotatorTest.kt` — `markdownSourceDiagnostics`: missing source file → ERROR, missing source anchor → WARNING, present anchor → no WARNING (via `FakeFileSystem`).
- `navigation/MarkdownSourceLinkContributorTest.kt` — `parseMarkdownHeading` range covers source span only; `resolveSourceReference` lands on comment line / fallback; `resolveInRoot`/`workspaceRelativePath` integration + escape rejection.

## Tests Still Required

- Live IntelliJ fixture tests for the annotator/completion/contributor extensions (require a full `LoadedPluginDescriptor` / `IdeaTestFixture`; light fixture does not invoke plugin EPs via `doHighlighting`/`findReferenceAt`/`complete`). Covered indirectly via the pure-function tests above.

## Files Created

- `jetbrains/IMPLEMENTATION_STATUS.md`
- `jetbrains/BEHAVIOR_SPEC.md`

## Files Modified

- (none)

## Do Not Change

- `src/` (VS Code implementation)
- `test/` (VS Code tests)
- `package.json`
- `.github/`
- `docs/`
- Any existing VS Code behavior

## Behavioral Differences From VS Code

- (none yet — document every adaptation as it is made)

## Open Questions

- IntelliJ version / platform range to target (WebStorm many versions vs recent-only). Defaulting to a recent WebStorm-compatible range.
- Whether completion kinds should mirror VS Code's `Value` kind.
- Exact `pluginVerification { ides { ... } }` DSL in IPGP 2.18.1 (deferred; verification optional for now).
