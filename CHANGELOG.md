# Change Log

All notable changes to the Comment Doc Links extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.20] - 2026-08-19

### Added

- Consume the `custom-biome-lint` **v1** JSON contract in both the VS Code and
  JetBrains adapters (envelope `version` / `files` / `summary`).
- Rule catalog support: `custom-biome-lint --rules` is queried so the IDE can
  surface each rule's description and default severity.

### Changed

- Lint diagnostics and quick-fix edits now use correct **UTF-8 byte → UTF-16**
  coordinate conversion, so they land on the right characters for multi-byte
  and emoji/astral text (e.g. `😀`).
- Linting runs over stdin (`custom-biome-lint --stdin <path>`) for unsaved
  buffers; non-zero CLI exits that still emit valid JSON are parsed.
- Multiple safe fixes and suppressions per violation are offered, and
  line-only rules produce whole-line ranges.

### Fixed

- Parity: the VS Code and JetBrains adapters share identical byte→UTF-16
  conversion math (verified by a shared fixture), so diagnostics and applied
  fixes match exactly across editors.

## [0.1.18] - 2026-08-18

### Fixed

- JetBrains: Markdown headings now resolve **both** source links and ticket
  links. Previously `MarkdownSourceLinkContributor` only matched the strict
  `## src/file.js — anchor` whole-heading format and never produced ticket
  references, so a heading like
  `## src/util/qrcode.js#local-qr-auto-size ENC-78788` resolved neither part.
  The contributor now scans each `MarkdownHeader` line for source references
  (`src/file.js#anchor`, `src/file.js — anchor`, `src/file.js - anchor`;
  `.md` targets excluded as forward links) and for configured
  `commentDocLinks.ticketLinks`, emitting a separate `MarkdownSourceReference`
  (source) and `CommentDocReference` (ticket) per match. Registration stays on
  `PlatformPatterns.psiElement().withLanguage("Markdown")`; each
  `MarkdownHeader` is filtered by a text-based ATX/Setext heading check (so
  ancestor blocks and non-heading tokens do not produce duplicate references),
  and both ATX (`#`/`##`…) and Setext (`===`/`---` underline) headings resolve.

## [0.1.17] - 2026-08-18

### Fixed

- JetBrains: de-duplicated the ticket-reference hover. The URL was shown twice
  on Ctrl/Cmd+Hover — once from the annotator's `EXTERNAL` tooltip and once from
  the resolved `TicketUrlTarget` navigation target. `TicketUrlTarget` now
  exposes only the ticket `label` via `getPresentation()`/`getName()`, so the
  URL appears exactly once (in the annotator tooltip) while Ctrl/Cmd+Click still
  opens the browser.

## [0.1.16] - 2026-08-18

### Fixed

- JetBrains: Markdown → source reverse navigation now resolves. The
  `MarkdownSourceLinkContributor` was registered on the dead
  `PlatformPatterns.psiFile()` pattern (never invoked during highlighting), so
  clicking `## src/file.js — anchor` headings did nothing. Re-registered on an
  element-level `PlatformPatterns.psiElement().withLanguage("Markdown")` pattern;
  each heading fires as a dedicated `MarkdownHeader` PSI element whose text is
  exactly that heading line, so `parseMarkdownHeading` matches only the heading
  (its token children and ancestor blocks do not), producing exactly one
  reference per heading with no duplicates.

## [0.1.15] - 2026-08-18

### Fixed

- JetBrains: references now resolve. The `CommentDocReferenceContributor`
  registered its provider on `PlatformPatterns.psiFile()`, but IntelliJ's daemon
  only invokes **element-level** reference providers (comments, literals, …)
  during highlighting — file-level providers are never called, so no links were
  ever produced. Re-registered on `PlatformPatterns.psiComment()` and rewrote
  `referencesForFile` to scan the whole document once (cached per document
  stamp) and return only the references whose range falls inside each comment.
- JetBrains: the `CommentDocLinkAnnotator` was declared with
  `language="ANY"`, which silently prevents the extension from being
  instantiated, so decorations and broken-link diagnostics never ran. Removed
  the attribute so the annotator applies to all languages.

## [0.1.14] - 2026-08-18

### Changed

- JetBrains: diagnostic rebuild to isolate why registered extensions are never
  invoked during real highlighting. Added a `CDL ANNOTATE class loaded` /
  `CDL ANNOTATE called` log and a second `psiComment()` reference provider
  (`CDL PROVIDER(comment)`) alongside the existing `psiFile()` one, to
  determine whether file-level providers are skipped by the daemon's reference
  pass while element-level (comment) providers are invoked.

## [0.1.13] - 2026-08-18

### Changed

- JetBrains: expanded startup diagnostics. The re-highlight pass now logs, for
  each already-open file, its path, language, and whether it is in the project
  content roots or excluded, then forces `psi.references` and reports how many
  `CommentDocReference`s were produced. This isolates "extension never invoked"
  from "invoked but produced no references" and from "file is excluded / not in
  project".

## [0.1.12] - 2026-08-18

### Fixed

- JetBrains: references and annotations now appear on files that were already
  open when the plugin finished loading. Restored tabs are highlighted by the
  IDE before our contributors register (plugin load finishes a few seconds
  after startup restores the previous session's editors), and IntelliJ does not
  re-highlight those files when a new plugin's contributors appear. The
  contributor now re-runs highlighting on every already-open editor once it is
  registered (`CDL REHIGHLIGHT` log line), so source↔doc links show without
  re-opening the file.

## [0.1.11] - 2026-08-18

### Fixed

- JetBrains: added entry-point diagnostic logging to confirm whether the
  reference contributors and annotator are instantiated/invoked at runtime in
  WebStorm (`CDL REGISTER` / `CDL MD REGISTER` / `CDL ANNOTATE`). This isolates
  "extensions never load" from "providers load but are never invoked".

## [0.1.10] - 2026-08-18

### Fixed

- JetBrains: corrected the optional JavaScript dependency id from
  `com.intellij.modules.javascript` to `JavaScript`. The previous id was treated
  as an unresolvable plugin id (`plugin com.intellij.modules.javascript is not
  resolved`), which excluded `withJavaScript.xml` and may have prevented the
  plugin's other extensions (navigation reference contributors) from
  registering in WebStorm. The `custom-biome-lint` inspection and source↔doc
  navigation now load.
- JetBrains: added diagnostic logging (`CDL PROVIDER` / `CDL CONTRIB` /
  `CDL MD CONTRIB` + per-skip reasons) to trace reference creation in WebStorm.

## [0.1.9] - 2026-08-18

### Fixed

- JetBrains: the `custom-biome-lint` inspection now loads correctly. The
  JavaScript dependency was declared with the wrong id (`com.intellij.javascript`
  instead of `com.intellij.modules.javascript`), which caused the plugin to
  exclude the inspection's config file in WebStorm and other JS-capable IDEs.
- JetBrains: source→doc navigation (Go to Declaration from a comment link, Find
  Usages on a documentation file) now resolves. The VFS lookup used
  `findFileByPath`, which returns null for documentation files not already loaded
  in the VFS; switched to `refreshAndFindFileByPath` so the target is located on
  disk. This was applied to all four resolution paths: the forward
  `CommentDocReference`, the `VfsFileSystem` helper, the backward
  `MarkdownSourceReference`, and the completion contributor's language
  detection. Added INFO diagnostics (`CDL CONTRIB` / `CDL FORWARD`) to the log.

## [0.1.8] - 2026-08-17

### Added

- Optional `custom-biome-lint` IDE linting, integrated into the same extension
  (VS Code and JetBrains) without a separate package.
- Auto-detection of the workspace-installed `custom-biome-lint` package; the
  feature is silently disabled when the package is missing.
- Lint diagnostics (error/warning) for JavaScript and JSX, mapped from the
  Rust linter's JSON output.
- Quick fix ("Apply safe fix") and suppression ("Suppress &lt;rule&gt;") code
  actions that apply the exact text edits returned by the Rust linter.
- Lint hover experience showing the rule id, message, severity and a link to
  rule documentation.
- Settings `commentDocLinks.lint.enabled` and `commentDocLinks.lint.autoDetect`.
- Commands `commentDocLinks.lint.file`, `commentDocLinks.lint.restart` and
  `commentDocLinks.lint.status`.
- Isolated `src/lint/` subsystem that never re-implements lint rules and keeps
  the rest of the extension unaware of the CLI (see
  `docs/custom-biome-lint-integration.md`).

## [0.1.7] - 2026-08-17

### Added

- Line-number documentation references: `file.md#L42` and `file.md:42` in
  source comments now jump to the referenced line in the documentation file.
- Diagnostics flag documentation line references that fall outside the target
  file.
- Issue references (`#123`), documentation ticket references (`DOC-123`) and
  API references (`API:Foo`) in comments are recognized, decorated, and
  explained on hover.
- A unified `commentDocLinks.openReference` command handles navigation for all
  reference types.
- Hover provider shows the resolution status of every recognized reference.
- Theme-aware highlighting of references via a new decoration provider.
- Markdown anchors now also resolve to GitHub-style slugs of plain headings
  (for example `## Checkout Flow` → `checkout-flow`).
- Expanded language support: Python, Java, Go, Rust, C, C++, C#, PHP, Ruby,
  Kotlin and Swift.
- Configurable settings: `enableDecorations`, `linkColor`, `linkUnderline`,
  `enableDiagnostics` and `enableCompletion`.
- Shared reference architecture under `src/references/` used by navigation,
  hover, decorations, diagnostics and completion.

### Changed

- Comment detection is now string-aware: comment markers inside string
  literals are not treated as comment starts.
- Documentation references no longer match inside URLs or absolute paths.
- Diagnostics and decorations validate through the single shared resolver.

### Removed

- The dedicated documentation-link regex module (`src/utils/regex.js`),
  replaced by the shared reference parser.

### Fixed

- JetBrains plugin: documentation-reference links in source comments on lines
  after the first (`// see docs/...md#anchor`) now resolve to the correct
  document location instead of a dangling, non-clickable range. The reference
  range is shifted by the line start offset so it is document-absolute.
- JetBrains plugin: clicking the `#anchor` portion of a documentation heading
  (`## src/file.js#anchor`) now navigates back to the source comment.

## [0.1.0] - 2026-08-08

### Added

- Two-way navigation between source comments and Markdown documentation.
- Source comment links: `file.md` and `file.md#anchor` in comments navigate to
  the Markdown document (and reveal the anchored section).
- Markdown heading links: `## src/file.js — anchor` navigates back to the
  source comment that references the anchor.
- Optional anchors: a missing anchor never blocks opening the target file.
- Exact anchor matching with no partial-match fallback.
- Diagnostics that flag references to missing documentation files and missing
  anchors (conservative, no false positives).
- Completion for anchors after `file.md#` in comments and after
  `## src/file.js —` in Markdown headings.
- Legacy heading separators tolerated when parsing existing documents:
  `-` and `#`.
- Unit tests for parsers, resolvers, diagnostics and suggestions.
- Language support for `.mjs`, `.cjs`, `.mts` and `.cts` module extensions.

### Changed

- Refactored navigation, resolution, diagnostics and completion into focused
  modules under `src/`.
- Completion now works inside multi-line block comments.
- Resolved file paths are validated against the workspace root.
- Diagnostics read from the in-memory buffer of open documents.

### Fixed

- Missing-anchor fallback no longer selects anchored references.
- Diagnostics no longer throw when a referenced file becomes unreadable.

## [0.0.1] - 2026-07-10

### Added

- Initial prototype: clickable links between source comments and Markdown
  documentation.
