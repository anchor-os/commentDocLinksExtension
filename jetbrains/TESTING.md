# Testing

## Framework

- **kotlin-test** for assertions, run on **JUnit 5** (`tasks.test { useJUnitPlatform() }`).
- **junit-vintage-engine** is on the test classpath for any vintage tests.
- **IntelliJ Platform test framework**: `testFramework(TestFrameworkType.Platform)` (from IPGP).

## Run the suite

```bash
cd jetbrains
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
./gradlew test
```

**97 tests** across 11 test classes, all passing.

## Strategy: pure-core testing

The IntelliJ **light test fixture does not invoke plugin extension points**
(`annotator`, `psi.referenceContributor`, `completion.contributor`) through
`doHighlighting()` / `findReferenceAt()` / `complete()`. So those integrations
are tested **indirectly** by extracting their logic into pure functions and
testing those directly with fake inputs:

- Core logic depends only on `DocumentLike` (a string-backed document) and
  `FileSystemLike` (an interface with `exists` / `readText`).
- Tests supply a `FakeFileSystem : FileSystemLike` and `stringDocument(...)` so no
  real files or VFS are needed.
- The annotator's markdown diagnostics, completion suggestions, and reverse
  navigation are exercised through `markdownSourceDiagnostics`,
  `suggestDocAnchorCompletions`, `suggestSourceAnchorCompletions`, and
  `resolveSourceReference` — all framework-free.

This gives full behavioral coverage of the resolution/parsing logic without a
heavyweight `LoadedPluginDescriptor` fixture.

## Test file map (counts)

| Test class | Count | Covers |
|---|---:|---|
| `parser/ReferenceParserTest.kt` | 24 | regex parity, offsets, line forms (`#L42`/`#l42`/`:42`), `#42` is anchor, issue/api/ticket, URL/Windows-path rejection |
| `resolver/AnchorResolverTest.kt` | 10 | `markdownSlug`, anchor resolution order, duplicate-suffix logic |
| `resolver/SourceReferenceResolverTest.kt` | 9 | exact-anchor win, file-only fallback, top-of-doc fallback, `./` normalization |
| `resolver/ReferenceValidatorTest.kt` | 17 | all `ResolutionStatus` values, line/anchor precedence, unreadable-tolerant |
| `resolver/PathResolutionTest.kt` | 8 | worktree `.git` gitfile, root selection, escape rejection, `relativize` safety |
| `resolver/LineCounterTest.kt` | 4 | line counting |
| `resolver/MarkdownParserTest.kt` | 6 | `## src/file.js — anchor` heading parsing |
| `parser/DocumentScannerTest.kt` | 7 | language guard, comment-only detection, string-literal skip, line offsets |
| `decorations/CommentDocLinkAnnotatorTest.kt` | 3 | `markdownSourceDiagnostics`: missing file → ERROR, missing anchor → WARNING |
| `completion/ReferenceCompletionContributorTest.kt` | 4 | `suggestDocAnchorCompletions`, `suggestSourceAnchorCompletions` |
| `navigation/MarkdownSourceLinkContributorTest.kt` | 5 | heading range, `resolveSourceReference`, `resolveInRoot` integration |

## Coverage gaps (known)

- Live IntelliJ fixture tests for the `annotator` / `referenceContributor` /
  `completion.contributor` extensions (require a full `LoadedPluginDescriptor`
  fixture). Covered indirectly via the pure-function tests above.
- No settings UI / color settings page yet (config is persisted but not surfaced
  in a Preferences panel).

## Running a single test class

```bash
./gradlew test --tests "com.anchor.commentdoclinks.resolver.ReferenceValidatorTest"
```
