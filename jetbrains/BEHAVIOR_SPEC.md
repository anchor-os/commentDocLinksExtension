# Behavior Specification — Comment Doc Links

Behavioral contract for the JetBrains plugin, derived from the existing
VS Code extension at the repository root. This is the source of truth for
behavior; the JetBrains implementation must not invent behavior beyond this
document unless explicitly marked as a JetBrains-specific adaptation.

---

## 1. Reference Types

A reference is normalized to exactly one of these types
(`src/references/referenceTypes.js`):

| Type | Identifier | Example | Local target? |
|---|---|---|---|
| Documentation | `documentation` | `documentation/foo.md#anchor` | filesystem file (`.md`) |
| Issue | `issue` | `#123` | No (external) |
| API | `api` | `API:Checkout` | No (external) |
| Ticket | `documentation` (with `file: null`) | `DOC-123` | No (external) |

A `DOC-123` ticket parses as a **documentation** type reference with
`file === null` and `identifier = "DOC-123"`. It resolves as `EXTERNAL`
because it carries no file.

## 2. Reference Data Model

A parsed reference has these fields:

```
type:      one of "documentation" | "issue" | "api"
raw:       the exact matched text
file:      relative path string, or null
anchor:    anchor string, or null
line:      integer, or null
identifier: external identifier, or null
start/end: character offsets (0-based) of the reference span in its line
```

## 3. Documentation References (Source Comments)

### 3.1 Detection regex

```
(?<![\w:./\\])([A-Za-z0-9_.-][A-Za-z0-9_./-]*\.md)
(?:(?::(\d+))|(?:#[Ll](\d+))|(?:#|\s+-\s+|\s+—\s+)([A-Za-z0-9_-]+))?
```

Rules (all tested in `referenceParser.test.js`):

- The path **must not start with `/`** — absolute paths are rejected.
  `see /Users/me/docs/file.md` → no reference.
- The look-behind rejects references inside URLs
  (`https://example.com/docs/file.md`), after word chars, after `:`,
  after `.`, after `/`, and after `\` (so `C:\docs\file.md` and
  `\\server\share\docs\file.md` are rejected).
- Relative dot paths ARE accepted: `./docs/file.md`.
- First path char must be `[A-Za-z0-9_.-]`, rest `[A-Za-z0-9_./-]*`.

### 3.2 Valid forms

| Form | file | anchor | line |
|---|---|---|---|
| `documentation/file.md` | `documentation/file.md` | null | null |
| `documentation/file.md#anchor` | file | `anchor` | null |
| `documentation/file.md - anchor` | file | `anchor` | null |
| `documentation/file.md — anchor` | file | `anchor` | null |
| `documentation/file.md:42` | file | null | **42** |
| `documentation/file.md#L42` | file | null | **42** |
| `documentation/file.md#l42` | file | null | **42** |
| `./docs/file.md` | `./docs/file.md` | — | — |

Anchor character set: `[A-Za-z0-9_-]+`.

### 3.3 Critically: `file.md#42` is NOT a line reference

`documentation/file.md#42` parses as anchor `"42"` (documentation heading
anchor), NOT line 42. This keeps `#anchor` and `#L42` from conflicting.
The `#42` form is **not valid as a line reference at all** — only `:42`,
`#L42`, and `#l42` are line references.

(Test: "issue reference inside a file anchor is consumed by documentation"
— `file.md#123` is one documentation reference with anchor `123`.)

### 3.4 Line semantics

- Line numbers are **1-based** and parsed as integers.
- Validation: `line >= 1 && line <= lineCount` where `lineCount` is the
  count of lines per the splitter `/\r\n|\r|\n/`.
- `line < 1` or `line > lineCount` → `INVALID_LINE`.
- Navigation: user-visible line `L` maps to document line index `L - 1`
  (reveal `line - 1`, column 0).
- When the target file is missing, `MISSING_FILE` wins over any line check.
- When the file exists but cannot be read (`readText` returns null),
  line/anchors are **not validated** — the reference is treated as `VALID`.

### 3.5 Offset behaviors

`parseComment(text, offset)` returns references with `start`/`end`
= `offset + span.start`/`offset + span.end`. `offset` is typically the
position of the comment text inside the line (e.g. after `// `).

## 4. Issue / API / Ticket References

| Form | Regex | Notes |
|---|---|---|
| `#123` | `(?<![\w:#])#(\d+)\b` | `foo#123` NOT a reference; `file.md#L42` not re-detected |
| `DOC-123` | `(?<!\w)DOC-(\d+)\b` | `DOC-123x` NOT a reference |
| `API:Foo` | `(?<!\w)API:([A-Za-z0-9_-]+)\b` | `xAPI:Foo` NOT a reference |

**Detection priority**: documentation references win over issue/ticket/API.
Overlapping spans are never reported twice — a reference inside an
already-matched documentation span is dropped (`detectReferenceSpans`).

## 5. Comment Detection (Source Files)

`src/parsers/languageSupport.js` — supported languages and comment styles:

| Style | Languages | Comment forms |
|---|---|---|
| slash | javascript, javascriptreact, typescript, typescriptreact, java, go, rust, c, cpp, csharp, kotlin, swift | `//`, `/* … */` |
| hash | python, ruby | `#` |
| yaml | yaml | `#` w/ block-scalar awareness |
| terraform | terraform | `#`, `//`, `/* … */`, heredocs |
| graphql | graphql | `#`, block strings |
| velocity | velocity | `##`, `#* … *#` |
| wholeLine | markdown | whole line |
| php | php | `//`, `#`, `/* … */`, only inside `<?php … ?>` |

**Must NOT scan inside string literals.** The scanner is stateful across
lines: multiline strings (`"""`, backticks, `@"…"`, heredocs) and block
comments opened on an earlier line are carried forward.

Reference spans are detected ONLY inside comment ranges (for source files)
or the whole line (for markdown). Arbitrary string/code text is never
treated as a reference.

File-extension → language map (used for reverse navigation & diagnostics):

```
.js .mjs .cjs → javascript     .jsx → javascriptreact
.ts .mts .cts → typescript     .tsx → typescriptreact
.gql .graphql → graphql        .tf → terraform
.yaml .yml → yaml              .vm .vtl → velocity
.md .markdown → markdown       .py → python
.java → java                   .go → go
.rs → rust                     .c .h → c
.cpp .cc .cxx .hpp → cpp       .cs → csharp
.php → php                     .rb → ruby
.kt .kts → kotlin              .swift → swift
```

## 6. Markdown Source References (Documentation → Source)

### 6.1 Heading detection

`src/parsers/markdownParser.js`:

```
^#{2,}\s+(.+?)(?:\s+—\s+|\s+-\s+|#)([A-Za-z0-9_-]+)$
```

Valid forms (exactly `#L2`+ heading level `##`, `###`, …):

```
## src/checkout/cart.js — checkout-flow
## src/checkout/cart.js - checkout-flow
## src/checkout/cart.js#checkout-flow
```

- `source` = the path match (group 1), `anchor` = group 2.
- `start`/`end` = character range of the **source path only** (not the
  separator or anchor) — this is the clickable/highlightable span.

### 6.2 Direction

- A markdown heading is a **documentation → source** link: the heading's
  source path resolves like a source file; clicking navigates to the source
  comment that references the documentation file + anchor.

### 6.3 Diagnostics for markdown headings

`collectBrokenMarkdownReferences`:

1. If the source target path resolves to null OR the file does not exist →
   `"Source file not found: <source>"`.
2. If `parsed.anchor` is empty, OR the source extension maps to no
   supported language, OR it maps to `markdown` → **no anchor check**
   (docs can reference markdown files without anchor matching).
3. Otherwise, read the source text and check `hasExactSourceReference`
   (a comment in the source file referencing
   `workspaceRelativePath(markdown doc)` with the exact anchor).
   If absent → `"Source anchor not found: <anchor>"`.

## 7. Anchor Resolution (Markdown Documents)

`src/services/anchorResolver.js`

Three representations, resolved in this order:

1. **Explicit documentation headings** — `## src/file.js — anchor`.
2. **HTML anchors** — `<a id="legacy-anchor"></a>` (regex
   `<a id="([A-Za-z0-9_-]+)"></a>`).
3. **Plain markdown headings** slugified (GitHub-style):
   `## Checkout Flow!` → `checkout-flow`, `## API & Errors` → `api--errors`.

### Slug algorithm

```
headingText.trim().toLowerCase()
  .replace(/[^\p{L}\p{N}_ -]/gu, "")   // keep letters, numbers, _, space, hyphen
  .replace(/ /g, "-")
```

### Duplicate headings

Repeated slugs get numeric suffixes: `foo`, `foo-1`, `foo-2`, …
A heading literally named `Foo-1` keeps its own slug `foo-1`, and
generated suffixes skip collisions (`## Foo-1, ## Foo, ## Foo` →
`["foo-1", "foo", "foo-2"]`).

### Match semantics

- Matching is **exact**, not prefix.
- Empty anchor → null.
- Anchor lookup order: explicit → HTML → slug. First match wins.
- `listAnchors` = all anchors in document order (sorted by line then
  character), deduplicated. Used by completion and diagnostics.

## 8. File & Path Resolution

### 8.1 Root selection (worktrees!)

`src/services/workspace.js` + `pathResolution.js`:

1. Candidate roots:
   - The workspace folder containing the referencing document.
   - The **nearest git checkout root** found by walking up from the
     referencing document's directory until a directory contains a
     `.git` entry.
2. A `.git` entry is a directory **OR a regular file** (gitfile — linked
   worktree or submodule). `hasGitEntry` checks both.
3. `chooseRoot` picks the **deepest** root that is an ancestor of the
   referencing document; falls back to the first root if none contain it
   or there is no context path.
4. Example: a document inside `worktree-A/` at
   `repo/worktrees/A/src/foo.js` where `worktree-A/.git` is a gitfile →
   nearest checkout root is `worktree-A`, and links resolve against
   `worktree-A`, **not** `repo`.

### 8.2 resolveInRoot

Rejects paths that escape the root, two ways:

1. **Lexical**: `path.relative(root, resolved)` must not be `..`/`../…`
   and must not be absolute.
2. **Physical**: after following symlinks (realpath of deepest existing
   ancestor), the target must still be inside the real root. A symlink
   escaping the root → rejected.

Nonexistent targets remain resolvable: the deepest existing ancestor is
resolved physically and the remaining components appended lexically (so
completion/diagnostics on not-yet-created files keep working).

### 8.3 Path forms

- Project-relative paths (no leading `./` or with `./`).
- `../` — allowed only if the result stays within the root.
- Backslashes normalized (`workspaceRelativePath` replaces `\` with `/`).
- Case sensitivity follows the OS semantics of the host FS.

### 8.4 Doc-file normalization

`./` prefix is ignored when comparing documentation file paths
(`normalizedFile`): `./docs/guide.md` round-trips with `docs/guide.md`.

## 9. Reference Resolution / Validation

`src/references/resolver.js` — the single validator used by navigation,
hover, decorations, and diagnostics.

### Statuses

| Status | Meaning |
|---|---|
| `valid` | Target exists; any anchor/line validated OK (or file unreadable) |
| `missing-file` | Target file doesn't exist |
| `missing-anchor` | File exists, anchor not present |
| `invalid-line` | File exists, line out of 1-based range |
| `invalid-path` | Path escapes the selected workspace/git root |
| `external` | Issue/API/DOC ticket (no local target) |

### Messages (used in diagnostics and command errors)

```
"Documentation file not found: <file>"
"Documentation anchor not found: <anchor>"
"Documentation line out of range: <line>"
"Documentation path is not allowed"
"Source file not found: <source>"
"Source anchor not found: <anchor>"
```

## 10. Navigation Behavior

### 10.1 Source comment → documentation (`openReference`)

1. Validate reference via shared resolver.
2. `EXTERNAL` → info message: `"This reference has no local target — it is
   tracked by an external system."`
3. `MISSING_FILE`/`INVALID_PATH` → error message (resolver message).
4. Otherwise open the target file, then reveal anchor or line:
   - Line given → reveal document line `line - 1`, column 0.
   - Anchor given → resolve anchor to (line, character), reveal.
   - A missing anchor never blocks navigation — file opens at current
     position (nothing revealed).

### 10.2 Markdown heading → source (`openSource`)

1. Resolve `source` path via `resolveWorkspacePath(source, wf, mdPath)`.
2. If unresolvable → error message; if no root → `"No workspace folder is
   open."` else `"Unable to resolve source file: <source>"`.
3. Open file. If the markdown document's relative path was passed, reveal
   the source comment that references that doc+anchor
   (`resolveSourceReference`).

`resolveSourceReference(sourceDocument, documentationFile, anchor)`:
- Exact `file#anchor` match wins (`anchorFound: true`).
- Otherwise first file reference without anchor (`anchorFound: false`).
- Otherwise top of file, line 0 col 0 (`anchorFound: false`).

## 11. Hover Content

Pure function `buildHoverMarkdown(reference, result)`:

- Documentation reference:
  - Header `**Documentation**`
  - Missing file → `` `file` `` + `Documentation file not found`
  - Otherwise `` `file` `` + (status-dependent detail):
    - MISSING_ANCHOR → `Documentation anchor not found: <anchor>`
    - INVALID_LINE → `Documentation line out of range: <line>`
    - INVALID_PATH → `Documentation path is not allowed`
    - else anchor → `Anchor: <anchor>` or line → `Line: <line>` (only when
      anchor/line present)
- Issue: `**Issue reference**` + `` `#<id>` ``
- API: `**API reference**` + `` `<id>` ``
- Ticket: `**Ticket reference**` + `` `<id>` ``
- Fallback: `**Documentation reference**` + `` `raw` ``

## 12. Decorations

- Valid (`valid`, `external`) references: theme link color
  (`textLink.foreground`), optional underline (default on).
- `missing-file`, `invalid-path`: error color
  (`editorError.foreground`).
- `missing-anchor`, `invalid-line`: warning color
  (`editorWarning.foreground`).
- Refresh debounced 250ms; only active editor is decorated.

## 13. Diagnostics

`DiagnosticsManager`:

- Runs per-document (open documents only). Produces **Warning** severity
  diagnostics on the full reference span (start..end on the reference's
  line).
- Reported cases: `missing-file`, `missing-anchor`, `invalid-line`,
  `invalid-path` (source comments); `Source file not found` +
  `Source anchor not found` (markdown headings).
- Conservatively skips unreadable targets (readText null) — no false
  positives.
- Extension never enumerates the whole workspace for diagnostics; only
  scans documents that are open or referenced by open documents.

### Dependency index & refresh

`ReferenceDependencyIndex` — in-memory `sourcePath → Set<targetPath>`
forward + reverse maps. Target paths are **final resolved absolute paths**,
so worktrees stay isolated. Version token (`mtimeMs:size` for disk files;
document `version` for open docs) avoids rescans.

Events:
- Document open → queue scan (ACTIVE priority) + revalidate dependents.
- Document change → queue scan + debounced (250ms) dependent refresh.
- Document close → remove index entry + clear diagnostics.
- Create/delete files → refresh dependents (region).
- Rename → snapshot dependents, remove old path, re-scan new path +
  dependents, refresh diagnostics of old+new paths' dependents.
- Config change → reset index, rescan all open.
- Active editor change → update diagnostics.

## 14. Scanning / Scheduling

- `PRIORITY`: ACTIVE=0, OPEN=1, TARGET=2 (lower runs first).
- `ScanScheduler`: bounded concurrency (3), priority queue, dedupes by
  key (higher/equal priority replaces pending), serialized per key,
  jobs start on later tick (never synchronously in `enqueue`), best-effort
  (`onError`), cooperative (yields between jobs).
- Extension never enumerates the whole workspace.
- Background disk scans read async, parse on the same thread, index
  dependency, validate torn reads (version re-check after read).

## 15. Completion

Two completion providers, both gated by `commentDocLinks.enableCompletion`:

1. **Source comments** — after `file.md#<partial>` inside a comment:
   suggest anchors from the target documentation file (`listAnchors`).
   Completion item kind = Value; replace range = partial anchor.
2. **Markdown headings** — after `## src/... — ` (em-dash or `-`, with
   trailing space or not): suggest anchors referenced by comments in the
   source file (`listSourceAnchors` for that doc). Inserts ` <anchor>`
   with a leading space if the prefix doesn't already end in whitespace.

No quick fixes / code actions exist in VS Code.

## 16. Commands

| Command | Behavior |
|---|---|
| `commentDocLinks.openReference` | Open ref target + reveal anchor/line |
| `commentDocLinks.openDocumentation` | Legacy wrapper: same as openReference with `(path, anchor, line, sourcePath)` args |
| `commentDocLinks.openSource` | Open source file from markdown heading + reveal source comment |

Command URIs encode JSON args in the href `command:<cmd>?<json>`.

## 17. Configuration

All under section `commentDocLinks`, window scope. Invalid values fall
back to defaults.

| Key | Default | Type | Effect |
|---|---|---|---|
| `enableDecorations` | true | boolean | Highlight references in editor |
| `linkColor` | `"theme"` | string | `theme` → `textLink.foreground`, else CSS color verbatim |
| `linkUnderline` | true | boolean | Underline valid references |
| `enableDiagnostics` | true | boolean | Broken-reference warnings |
| `enableCompletion` | true | boolean | Anchor suggestions |

## 18. Line Counting & Line Endings

`documentFromText` splits text on `/\r\n|\r|\n/`. Line count = number of
segments. CRLF and bare-CR files behave like LF files (verified in
diagnostics tests).

## 19. File Extension Support (Documentation)

Only `.md` is a documentation extension (`MARKDOWN_EXTENSION`). A
documentation reference requires the `\.md` suffix.

## 20. Behavior Summary — Examples

```
src/util/salesDashboardV2/getRevenueByBusinessCategory2.js
  → comments may reference documentation/claude/comments/ticketnumber-74995.md
  → and anchors #reconciliation-guarantee

documentation/claude/comments/ticketnumber-74995.md
  → headings like:
    ## src/util/salesDashboardV2/getRevenueByBusinessCategory2.js — reconciliation-guarantee
    ## src/util/salesDashboardV2/getRevenueByBusinessCategory2.js#reconciliation-guarantee
```

## 21. JetBrains-Specific Adaptation Notes

Documented deviations/adaptations only — no new behavior:

- VS Code uses one document selector for many language IDs; JetBrains will
  register per-language features via IntelliJ's PSI/annotator/completion
  APIs for the same set of languages.
- IntelliJ line APIs are 0-based internally; all user-visible line numbers
  must remain 1-based to match.
- IntelliJ markup/anchor navigation uses `Editor.markupModel` /
  `ScrollToModel`; hover uses `ExternalAnnotator`-independent lookup or the
  `ReferenceContributor`+`PsiReference` mechanism.
- The workspace-git-root selection maps to IntelliJ `Project` + git root
  detection; worktree `.git` gitfile handling must be reimplemented with
  VFS (do not assume `.git` is a directory).