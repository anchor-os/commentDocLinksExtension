# Change Log

All notable changes to the Comment Doc Links extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
