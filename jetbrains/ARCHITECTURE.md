# Architecture

The plugin is a **port** of the VS Code extension. It keeps the same layered
shape: a pure, framework-agnostic core (parsing + resolution) wrapped by a thin
IntelliJ-boundary layer that feeds IDE data into the core and renders the
results through IntelliJ extension points.

> **Source of truth.** The VS Code extension under `src/` (and its `test/`,
> `docs/`) defines the behavior. Every **pure-core** Kotlin module
> (`model/`, `parser/`, `resolver/`) maps 1:1 to a VS Code module (see
> `PARITY_MATRIX.md`). The IntelliJ boundary layers (`services/`, `navigation/`,
> `decorations/`, `completion/`, `config/`) are platform adapters with no direct
> VS Code equivalent. Do not invent behavior that is not in the VS Code code.

## Layers

 ```text
com.anchor.commentdoclinks
├── model/          # Pure data: ParsedReference, ReferenceType, ResolutionStatus, ResolutionResult, DocumentLike
├── parser/         # Pure: ReferenceParser (regex), LanguageSupport (comment scanner), DocumentScanner
├── resolver/       # Pure: AnchorResolver, PathResolution, SourceReferenceResolver, ReferenceValidator, MarkdownParser, LineCounter
├── services/       # IntelliJ boundary: DocumentAdapters, VfsFileSystem, WorkspaceRootService
├── navigation/     # IntelliJ EP: CommentDocReference, CommentDocReferenceContributor, MarkdownSourceReference, MarkdownSourceLinkContributor
├── decorations/     # IntelliJ EP: CommentDocLinkAnnotator (highlight + diagnostics)
├── completion/      # IntelliJ EP: ReferenceCompletionContributor
└── config/         # IntelliJ EP: CommentDocLinksConfig (commentDocLinks.* settings)
```

### Pure core (no IntelliJ dependency)
- `model/` — data classes and enums only.
- `parser/` — turns raw text into `ParsedReference`s.
  - `ReferenceParser` — reference regexes and `parseComment`/`parseReference`.
  - `LanguageSupport` — per-language comment detection state machine (`getCommentRanges`).
  - `DocumentScanner.scanDocumentForReferences` — the **single shared scan** used by every feature.
- `resolver/` — resolves a parsed reference to a target.
  - `AnchorResolver` — markdown slug + anchor location.
  - `PathResolution` — git-root resolution, escape rejection, worktree-aware.
  - `SourceReferenceResolver` — reverse navigation (doc heading → source comment).
  - `ReferenceValidator` — single source of truth for `ResolutionStatus` + messages.
  - `MarkdownParser` — `## src/file.js — anchor` heading parsing.
  - `LineCounter` — line counting for line validation.

All pure-core functions take explicit inputs (e.g. `DocumentLike`, `FileSystemLike`)
so they are directly unit-testable without an IntelliJ fixture.

### IntelliJ boundary (`services/`)
- `DocumentAdapters` — `documentLikeFromDocument`, `languageIdFromVirtualFile`.
- `VfsFileSystem : FileSystemLike` — exists/readText over the IntelliJ VFS; prefers the open editor document, then file bytes + charset.
- `WorkspaceRootService` — resolves the git checkout root (cached per document path) and produces workspace-relative paths.

### Extension points (`plugin.xml`)

| Extension | Implementation | Behavior |
|---|---|---|
| `psi.referenceContributor` | `CommentDocReferenceContributor` | attaches `CommentDocReference`s (forward links) |
| `psi.referenceContributor` | `MarkdownSourceLinkContributor` | attaches `MarkdownSourceReference`s (reverse links) |
| `completion.contributor` | `ReferenceCompletionContributor` | anchor/source-anchor completion |
| `annotator` (`language="ANY"`) | `CommentDocLinkAnnotator` | highlight + broken-reference diagnostics |

## Data flow — forward navigation (comment → doc)

 ```text
Annotator / ReferenceContributor (per PsiFile)
  → scanDocumentForReferences(doc, languageId)            [parser/DocumentScanner]
  → parseComment / parseReference                          [parser/ReferenceParser]
  → validateReference(reference, ::resolveInRoot, VfsFileSystem)  [resolver/ReferenceValidator]
        resolveInRoot(root, file)                          [resolver/PathResolution]
        VfsFileSystem.exists / readText                    [services/VfsFileSystem]
        listAnchors / resolveAnchor (for anchor refs)      [resolver/AnchorResolver]
  → ResolutionResult { status, targetPath, line, message }
  → CommentDocReference.resolve() opens target PsiFile at line/anchor
```

## Data flow — reverse navigation (doc heading → source comment)

 ```text
MarkdownSourceLinkContributor (per markdown heading)
  → parseMarkdownHeading(line)                              [resolver/MarkdownParser]
  → resolveSourceReference(doc, languageId, source, anchor) [resolver/SourceReferenceResolver]
  → opens the source file at the commenting line
```

## Configuration

`config/CommentDocLinksConfig` persists `commentDocLinks.*` keys in IntelliJ's
application `PropertiesComponent` (defaults = enabled):

| Key | Effect |
|---|---|
| `commentDocLinks.enableDecorations` | link-color highlighting on/off |
| `commentDocLinks.enableDiagnostics` | broken-reference ERROR/WARNING on/off |
| `commentDocLinks.enableCompletion` | completion suggestions on/off |

(`linkColor` / `linkUnderline` are accepted for VS Code parity but not yet wired into the highlighter.)

## Resolution model

`ReferenceType`: `DOCUMENTATION`, `ISSUE`, `API`. (`DOC-123` parses as a
`DOCUMENTATION`-typed **external** reference.)

`ResolutionStatus`: `VALID`, `MISSING_FILE`, `MISSING_ANCHOR`, `INVALID_LINE`,
`INVALID_PATH`, `EXTERNAL`. Navigation, hover, diagnostics, and decorations all
consume `ResolutionResult` identically, so a reference is never "valid when
clicked" but "broken in diagnostics".

## Key invariants

- `#42` is a **heading anchor**, not a line reference. Only `:42`, `#L42`, `#l42` are line references.
- Line numbers are 1-based for users; IntelliJ internals are 0-based.
- `.git` may be a directory (checkout) or a file (worktree gitfile); never assume a directory.
- Root = deepest git checkout root (or project base) that contains the referencing document.
- Issue/API/`DOC-…` references are external: shown as info, never as broken diagnostics.
- The plugin never enumerates the whole workspace; it scans only open + referenced documents.
