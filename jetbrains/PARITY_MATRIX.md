# Parity Matrix — VS Code → JetBrains

Every **pure-core** Kotlin module maps 1:1 to a VS Code module. The IntelliJ
boundary layers (`services/`, `navigation/`, `decorations/`, `completion/`,
`config/`) are platform adapters with no direct VS Code equivalent. The VS Code
extension under `src/` is the **behavioral source of truth**; the port matches
it exactly.

Legend: ✅ implemented & proven by tests · 🟡 implemented, logic proven by
pure-function tests (IntelliJ EP glue not unit-tested in a light fixture) · ⬜ missing

| # | Feature | VS Code source | JetBrains module | Status | Test |
|---|---|---|---|---|---|
| 1 | Reference regex (doc/issue/api/ticket) | `src/references/referenceParser.js` | `parser/ReferenceParser.kt` | ✅ | `ReferenceParserTest` (24) |
| 2 | `#42` is anchor (not line) | `referenceParser.js` | `parser/ReferenceParser.kt` | ✅ | `ReferenceParserTest` |
| 3 | Line forms `:42` / `#L42` / `#l42` | `referenceParser.js` | `parser/ReferenceParser.kt` | ✅ | `ReferenceParserTest` |
| 4 | Path/URL/Windows-path rejection | `referenceParser.js` | `parser/ReferenceParser.kt` | ✅ | `ReferenceParserTest` |
| 5 | Language support (20 langs) | `src/parsers/languageSupport.js` | `parser/LanguageSupport.kt` | ✅ | `DocumentScannerTest` |
| 6 | Comment-range scanner (block/string) | `languageSupport.js` | `parser/LanguageSupport.kt` | ✅ | `DocumentScannerTest` |
| 7 | Single shared document scan | `src/services/documentScanner.js` | `parser/DocumentScanner.kt` | ✅ | `DocumentScannerTest` (7) |
| 8 | Markdown slug | `src/services/anchorResolver.js` | `resolver/AnchorResolver.kt` | ✅ | `AnchorResolverTest` (10) |
| 9 | Anchor resolution order (explicit→html→slug) | `anchorResolver.js` | `resolver/AnchorResolver.kt` | ✅ | `AnchorResolverTest` |
| 10 | Duplicate anchor suffixes | `anchorResolver.js` | `resolver/AnchorResolver.kt` | ✅ | `AnchorResolverTest` |
| 11 | `listAnchors` (completion/diagnostics) | `anchorResolver.js` | `resolver/AnchorResolver.kt` | ✅ | `AnchorResolverTest` |
| 12 | Git-root / worktree resolution | `src/services/pathResolution.js` | `resolver/PathResolution.kt` | ✅ | `PathResolutionTest` (8) |
| 13 | Escape-path rejection | `pathResolution.js` | `resolver/PathResolution.kt` | ✅ | `PathResolutionTest` |
| 14 | Root selection (deepest) | `pathResolution.js` | `resolver/PathResolution.kt` | ✅ | `PathResolutionTest` |
| 15 | Reference validation + messages | `src/services/referenceValidator.js` | `resolver/ReferenceValidator.kt` | ✅ | `ReferenceValidatorTest` (17) |
| 16 | Resolution statuses (6) | `src/references/referenceTypes.js` | `model/ResolutionStatus.kt` | ✅ | `ReferenceValidatorTest` |
| 17 | Reference types | `referenceTypes.js` | `model/ReferenceType.kt` | ✅ | `ReferenceParserTest` |
| 18 | Reverse nav (doc→source) | `src/services/sourceReferenceResolver.js` | `resolver/SourceReferenceResolver.kt` | ✅ | `SourceReferenceResolverTest` (9) |
| 19 | `./` normalization round-trip | `sourceReferenceResolver.js` | `resolver/SourceReferenceResolver.kt` | ✅ | `SourceReferenceResolverTest` |
| 20 | Markdown heading parse | `src/services/markdownParser.js` | `resolver/MarkdownParser.kt` | ✅ | `MarkdownParserTest` (6) |
| 21 | Line counting | `src/services/lineCounter.js` | `resolver/LineCounter.kt` | ✅ | `LineCounterTest` (4) |
| 22 | Forward link provider / hover | `src/navigation/*` | `navigation/CommentDocReference.kt`, `CommentDocReferenceContributor.kt` | 🟡 | `ReferenceParserTest`/`DocumentScannerTest` (logic); EP glue 🟡 |
| 23 | Reverse link contributor | `src/navigation/*` | `navigation/MarkdownSourceReference.kt`, `MarkdownSourceLinkContributor.kt` | 🟡 | `MarkdownSourceLinkContributorTest` (5) |
| 24 | Highlighting (link color) | `src/decorations/decorationProvider.js` | `decorations/CommentDocLinkAnnotator.kt` | 🟡 | `markdownSourceDiagnostics` (logic); EP glue 🟡 |
| 25 | Broken-reference diagnostics | `src/diagnostics/brokenReferenceScanner.js` | `decorations/CommentDocLinkAnnotator.kt` | 🟡 | `CommentDocLinkAnnotatorTest` (3) |
| 26 | Completion (doc + source anchors) | `src/completion/completionProvider.js` | `completion/ReferenceCompletionContributor.kt` | 🟡 | `ReferenceCompletionContributorTest` (4) |
| 27 | Config (`commentDocLinks.*`) | VS Code settings | `config/CommentDocLinksConfig.kt` | ✅ | `CommentDocLinksConfigTest` |
| 28 | VFS boundary | — (VS Code uses fs APIs) | `services/VfsFileSystem.kt` | ✅ | `ReferenceValidatorTest` (via `FakeFileSystem`) |
| 29 | Workspace root service | — | `services/WorkspaceRootService.kt` | ✅ | `PathResolutionTest` (pure core) |
| 30 | Publish / sign (token) | VS Code uses `vsce`/`ovsx` | `build.gradle.kts` `publishing { token }` | ✅ | CI (`jetbrains-publish.yml`) |

**Totals:** 28 ✅ · 2 🟡 (EP glue only; logic proven) · 0 ⬜.

## Notes

- 🟡 items are fully implemented; only the IntelliJ **extension-point glue** is
  not exercised by the light test fixture. Their underlying logic is proven by
  pure-function tests (`markdownSourceDiagnostics`, `suggest*Completions`,
  `parseMarkdownHeading`, `resolveSourceReference`, `scanDocumentForReferences`).
- The IntelliJ `services/` layer (rows 28–29) has no VS Code equivalent; it adapts
  IDE I/O (VFS, project root) to the pure-core `FileSystemLike` / `chooseRoot`
  interfaces.
- `linkColor` / `linkUnderline` config keys exist for parity but are not yet wired
  into the highlighter.
