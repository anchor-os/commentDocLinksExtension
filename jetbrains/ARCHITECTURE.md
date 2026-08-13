# JetBrains Plugin Architecture

Design for the `Comment Doc Links` IntelliJ Platform plugin, ported behaviorally
from the VS Code extension (see `BEHAVIOR_SPEC.md`).

## Principles

1. **Behavioral parity first.** Port the behavior/architecture/contracts from the
   VS Code extension; do not translate JavaScript mechanically into Kotlin.
2. **Pure core, thin platform shell.** Parsing, resolution core, anchor logic and
   line counting are plain Kotlin — no IntelliJ dependency — so they are unit
   testable without launching an IDE.
3. **Use IntelliJ idioms at the boundary.** VFS, PSI, annotators, completion
   providers, actions, `Editor` positioning all use IntelliJ Platform APIs.
4. **No unnecessary abstraction layers.** Small services with clear responsibilities.
5. **Independently buildable.** `jetbrains/` builds with Gradle alone; no npm coupling.

## Package Layout

Package root: `com.anchor.commentdoclinks`

```
jetbrains/src/main/kotlin/com/anchor/commentdoclinks/
├── model/          # Pure domain model (no IntelliJ imports)
│   ├── Reference.kt          # parsed reference (type, raw, file, anchor, line, identifier, span)
│   ├── ReferenceType.kt      # DOCUMENTATION, ISSUE, API
│   ├── ResolutionStatus.kt   # VALID, MISSING_FILE, MISSING_ANCHOR, INVALID_LINE, INVALID_PATH, EXTERNAL
│   ├── ResolutionResult.kt   # status + targetPath + line + message
│   └── DocumentLike.kt       # minimal line-view over text (mirrors vscode TextDocument)
├── parser/         # Pure parsing (no IntelliJ imports)
│   ├── ReferenceParser.kt    # detectReferenceSpans, parseReference, parseComment
│   ├── MarkdownParser.kt     # parseMarkdownHeading
│   └── LanguageSupport.kt    # supported languages, comment styles, extension→language map
├── resolver/       # Pure resolution core (no IntelliJ imports)
│   ├── PathResolution.kt     # resolveInRoot, findCheckoutRoot, chooseRoot, realpath logic
│   ├── AnchorResolver.kt     # markdownSlug, resolveAnchor, listAnchors
│   ├── SourceReferenceResolver.kt  # resolveSourceReference, hasExactSourceReference, listSourceAnchors
│   ├── ReferenceValidator.kt # validateReference + diagnostics messages
│   └── LineCounter.kt        # countLines (LF/CRLF/CR)
├── services/       # IntelliJ-backed services
│   ├── WorkspaceRootService.kt  # workspace folder + git checkout root detection (worktrees)
│   ├── VfsFileSystem.kt         # exists/readText over IntelliJ VirtualFileSystem
│   └── CommentDocLinksApplication.kt  # plugin/service registration, app-level config
├── navigation/     # IntelliJ navigation
│   ├── ReferenceHyperlink.kt    # editor click → open target + reveal anchor/line
│   ├── MarkdownHeadingHyperlink.kt # markdown → source navigation
│   └── EditorRevealer.kt        # reveal line/anchor with correct 0-based conversion
├── diagnostics/    # IntelliJ annotators + broken-reference scanning
│   ├── BrokenReferenceAnnotator.kt  # per-file annotator, Warning severity on full span
│   ├── BrokenReferenceScanner.kt    # pure scan: collect broken refs in a document
│   └── ReferenceDependencyIndex.kt  # in-memory source→target index (session cache)
├── completion/     # IntelliJ completion
│   ├── CommentAnchorCompletionContributor.kt # after file.md# inside comments
│   ├── MarkdownAnchorCompletionContributor.kt # after ## src/... — heading
│   └── SuggestionExtractors.kt   # extractDocFileAfterHash, extractHeadingSourceBeforeDash, anchorSuffixRange
├── commands/       # IntelliJ actions
│   ├── OpenReferenceAction.kt
│   ├── OpenDocumentationAction.kt
│   └── OpenSourceAction.kt
├── util/
│   └── CommandUri.kt            # NOT needed in IntelliJ (no command URIs) — actions instead
└── CommentDocLinksPlugin.kt     # plugin.xml entry point / service registration
```

## Data Flow

```
source comment or markdown heading text
        │  parser/ (pure Kotlin)
        ▼
model.Reference (typed, span+offset aware)
        │  services/WorkspaceRootService + resolver/PathResolution
        ▼
absolute target path (worktree-aware)   ──►  VfsFileSystem.exists/readText
        │  resolver/ReferenceValidator (+ AnchorResolver, LineCounter)
        ▼
model.ResolutionResult (status, targetPath, line, message)
        │
        ├── ► diagnostics + completion + hover + navigation all consume this
        ▼
IntelliJ API boundary (annotator on demand, completion contributor, actions)
```

## Worktree-Aware Path Handling (critical)

- `WorkspaceRootService` mirrors `resolveWorkspaceRoot`:
  candidate roots = IntelliJ project content/file roots + **nearest git checkout
  root** (walked up from the referencing file's directory using VFS).
- `.git` is detected as a **directory** (main checkout) OR a **file** whose first
  line is `gitdir:` (linked worktree / submodule). Never assume `.git` is a dir.
- Deepest root that contains the referencing document wins (`chooseRoot`).
- `PathResolution.resolveInRoot` guards against escape both lexically (`..`)
  and physically (realpath/symlink containment).
- All path handling uses the IntelliJ project/VFS model — never the process CWD.

## IntelliJ Mapping

| VS Code concept | IntelliJ Platform equivalent |
|---|---|
| `TextDocument` | `Document` (via `FileDocumentManager`) |
| `Document.uri` | `VirtualFile` |
| Document link provider (comments) | `PsiReferenceContributor` + `PsiReference` or editor `ReferenceInjectable`; simplest: `PsiReferenceContributor` per language |
| Document link provider (markdown headings) | `PsiReferenceContributor` on Markdown PSI or `ExternalAnnotator`-independent link via a dedicated `PsiReference` |
| Hover | Hover via `ReferenceContributor` provides hover implicitly; optional `ExternalAnnotator` hover |
| Decorations | `EditorMarkupModel` / `RangeHighlighter` (color per status) |
| Diagnostics | `ExternalAnnotator` or `AnnotationHolder` annotator (Warning severity) |
| Completion | `CompletionContributor` (two: comments trigger `#`, markdown headings trigger `—`/`-`) |
| Commands | `AnAction` subclasses registered in `plugin.xml` |
| Workspace folder + git root | `Project` + git root detection (worktree aware) |
| Document change events | `FileDocumentManager` listeners / project `MessageBus` |
| Config (`commentDocLinks.*`) | `PropertiesComponent` per-plugin setting |

## Line Number Semantics

- Users see **1-based** lines exactly like VS Code.
- IntelliJ `Document` uses **0-based** line indexing.
- Conversion is centralized in `EditorRevealer` and `ReferenceValidator`:
  `userLine - 1` when converting to 0-based; validation range `1..lineCount`.

## Dependency Direction

- `model`, `parser`, `resolver` depend on nothing from the IntelliJ Platform.
- `services`, `navigation`, `diagnostics`, `completion`, `commands` depend on
  both the pure core and the IntelliJ Platform SDK.
- The pure core carries the test matrix (deterministic, no IDE needed); the
  IntelliJ layer gets lightweight integration tests in a headless test fixture.

## Performance

- Never enumerate the whole repository. Scan open documents + referenced targets only.
- Cache resolved targets per document (`ReferenceDependencyIndex` keyed by
  file version: `mtimeMs:size` on disk, `Document` version for open files).
- The IntelliJ annotator should implement `doAnnotate` on committed documents and
  be incremental-aware; heavyweight scanning stays out of the EDT.
- Completion reads at most the single referenced file synchronously (small).
- Debounce refresh events (250 ms) exactly like VS Code.