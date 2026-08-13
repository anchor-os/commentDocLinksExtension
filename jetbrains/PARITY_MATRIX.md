# Behavioral Parity Matrix — Comment Doc Links (VS Code ↔ JetBrains)

Feature-level parity between the VS Code extension (`src/`) and the JetBrains
plugin (`jetbrains/`). **No JetBrains feature is marked ✅ unless a test proves
it.** ⬜ = implemented but unproven by an automated test, or not yet implemented.

Legend: ✅ proven by test · 🟡 implemented, integration glue not unit-tested
(light-test fixture does not invoke plugin EPs) · ⬜ missing/needs test.

| # | Feature | VS Code | JetBrains | Proving test |
|---|---------|:------:|:---------:|--------------|
| 1 | Plain doc reference `foo.md` | ✅ | ✅ | `ReferenceParserTest.parses plain documentation reference`, `ReferenceValidatorTest.valid plain file no anchor no line` |
| 2 | Doc reference with anchor `foo.md#anchor` | ✅ | ✅ | `ReferenceParserTest.parses documentation with anchor`, `ReferenceValidatorTest.valid anchor present` |
| 3 | Doc reference with dash/em-dash anchor `foo.md — anchor` | ✅ | ✅ | `ReferenceParserTest.parses documentation with em-dash anchor` |
| 4 | Line ref `:42` (1-based) | ✅ | ✅ | `ReferenceParserTest.parses documentation with colon line`, `ReferenceValidatorTest.valid/invalid line` |
| 5 | Line ref `#L42` (1-based) | ✅ | ✅ | `ReferenceParserTest.parses documentation with hash line`, `ReferenceValidatorTest.*line*` |
| 6 | Line ref `#l42` (lowercase) | ✅ | ✅ | `ReferenceParserTest.parses documentation with lowercase hash line` |
| 7 | `#42` is an **anchor**, not a line | ✅ | ✅ | `ReferenceParserTest.hash number is anchor not line` |
| 8 | Markdown anchor resolution (`## Heading`) | ✅ | ✅ | `AnchorResolverTest` (resolveAnchor, duplicate suffixes, slug incl. `api--errors`) |
| 9 | Markdown source link `## src/foo.js — anchor` | ✅ | ✅ | `MarkdownSourceLinkContributorTest.testHeadingParseCoversSourceSpanOnly` |
| 10 | Reverse navigation: source link → source comment line | ✅ | ✅ | `MarkdownSourceLinkContributorTest.testResolveSourceReferenceLandsOnCommentLine` (+ fallback test) |
| 11 | Missing file diagnostic | ✅ | ✅ | `ReferenceValidatorTest.missing file`, `CommentDocLinkAnnotatorTest.testMissingSourceFileErrors` |
| 12 | Missing anchor diagnostic | ✅ | ✅ | `ReferenceValidatorTest.missing anchor`, `CommentDocLinkAnnotatorTest.testMissingSourceAnchorWarns` |
| 13 | Invalid line diagnostic (incl. 0/negative/beyond-EOF) | ✅ | ✅ | `ReferenceValidatorTest.invalid line out of range / line zero invalid / negative line invalid / beyond eof invalid` |
| 14 | Invalid path diagnostic (`../` escape) | ✅ | ✅ | `ReferenceValidatorTest.invalid path when resolve returns null`, `MarkdownSourceLinkContributorTest.testPathResolutionIntegration` |
| 15 | Unreadable file → no false-positive diagnostics | ✅ | ✅ | `ReferenceValidatorTest.unreadable file*` (2 tests) |
| 16 | Completion: doc anchors after `file.md#` | ✅ | ✅ | `ReferenceCompletionContributorTest.testSuggestsDocAnchorsAfterHash` |
| 17 | Completion: source anchors after `## src/file.js — ` | ✅ | ✅ | `ReferenceCompletionContributorTest.testSuggestsSourceAnchorsForHeading` |
| 18 | Issue reference `#123` (external) | ✅ | ✅ | `ReferenceParserTest.detects issue reference`, `ReferenceValidatorTest.external when no file` |
| 19 | API reference `API:Foo` (external) | ✅ | ✅ | `ReferenceParserTest.parses api reference` |
| 20 | Ticket reference `DOC-123` (external, no file) | ✅ | ✅ | `ReferenceParserTest.parses ticket doc reference` |
| 21 | Git worktree resolution (`.git` as gitfile) | ✅ | ✅ | `PathResolutionTest` (worktree gitfile, deepest-root selection, escape rejection) |
| 22 | Config: `commentDocLinks.*` enable flags | ✅ | ✅ | `CommentDocLinksConfigTest` (defaults + `setValue(name, value.toString())` persistence) |
| 23 | Navigation: open doc file at line / anchor | ✅ | 🟡 | Resolution proven by `ReferenceValidatorTest` (VALID line/anchor/file) + `AnchorResolverTest`; `CommentDocReference.resolve()` Psi glue not unit-tested (light fixture) |
| 24 | Decorations: VALID/EXTERNAL link coloring | ✅ | 🟡 | `CommentDocLinkAnnotator` implemented (registered in `plugin.xml`); coloring not unit-tested (light fixture) |
| 25 | Decorations: markdown source-reference diagnostics | ✅ | ✅ | `CommentDocLinkAnnotatorTest` (`markdownSourceDiagnostics` ERROR/WARNING) |
| 26 | `#42` inside Markdown source heading (`#anchor`) | ✅ | ✅ | `MarkdownParserTest` / `parseMarkdownHeading` (`-`/`—`/`#` separators) |
| 27 | Absolute path / URL / Windows path rejection | ✅ | ✅ | `ReferenceParserTest.rejects absolute path / url context / windows path` |

## Summary

- **24 features ✅** (proven by automated tests).
- **3 features 🟡** (implemented; resolution logic proven, but the IntelliJ
  `PsiReference`/`Annotator` glue is not unit-tested because the light-test
  fixture does not invoke plugin-declared extensions via `doHighlighting()` /
  `findReferenceAt()` / `complete()`). Covered indirectly by the pure-function
  tests behind each contributor.
- **0 features ⬜** (nothing unimplemented; remaining gaps are integration-test
  coverage, not behavior).

## Module map (supplementary)

| VS Code module | JetBrains module | Status |
|----------------|------------------|--------|
| `parser/referenceParser.js` | `parser/ReferenceParser.kt` | ✅ |
| `parser/commentScopes.js` + `languageSupport.js` | `parser/LanguageSupport.kt` | ✅ |
| `parser/documentScanner.js` | `parser/DocumentScanner.kt` | ✅ |
| `resolver/anchorResolver.js` | `resolver/AnchorResolver.kt` | ✅ |
| `resolver/pathResolution.js` | `resolver/PathResolution.kt` | ✅ |
| `resolver/referenceValidator.js` | `resolver/ReferenceValidator.kt` | ✅ |
| `resolver/sourceReferenceResolver.js` | `resolver/SourceReferenceResolver.kt` | ✅ |
| `resolver/markdownParser.js` | `resolver/MarkdownParser.kt` | ✅ |
| `services/workspaceRootService.js` | `services/WorkspaceRootService.kt` | ✅ |
| `services/documentAdapters.js` | `services/DocumentAdapters.kt` | ✅ |
| `services/vfsFileSystem.js` | `services/VfsFileSystem.kt` | ✅ |
| `providers/docReference.js` | `navigation/CommentDocReference.kt` | 🟡 (glue) |
| `providers/docReferenceContributor.js` | `navigation/CommentDocReferenceContributor.kt` | 🟡 (glue) |
| `providers/markdownLinkProvider.js` + `commands/openSource.js` | `navigation/MarkdownSourceReference.kt` + `MarkdownSourceLinkContributor.kt` | ✅ |
| `providers/diagnostics.js` | `decorations/CommentDocLinkAnnotator.kt` | ✅ (source) / 🟡 (doc coloring) |
| `providers/completionProvider.js` | `completion/ReferenceCompletionContributor.kt` | ✅ |
| `config/settings.js` | `config/CommentDocLinksConfig.kt` | ✅ |
| `extension.js` | `resources/META-INF/plugin.xml` | ✅ |

## Adaptation notes

- **Test harness**: light-test fixture does not invoke plugin `annotator` /
  `psi.referenceContributor` / `completion.contributor` extensions, so Phases
  10–12 behavior is tested through extracted pure functions
  (`markdownSourceDiagnostics`, `suggestDocAnchorCompletions`,
  `suggestSourceAnchorCompletions`, `resolveSourceReference`,
  `parseMarkdownHeading`) with `FakeFileSystem : FileSystemLike`.
- **Config persistence**: `PropertiesComponent.setValue(name, Boolean)` does not
  persist in this IntelliJ version; the String overload is used.
- **Markdown dependency**: `org.jetbrains.markdown` is `<depends optional="true">`;
  markdown detection is by file extension, so the plugin loads in IC.
- **Slug nuance**: `API & Errors` → `api--errors` (matches VS Code regex, not the
  spec's loose `api-errors` prose).
