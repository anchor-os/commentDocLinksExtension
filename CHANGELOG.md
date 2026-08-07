# Change Log

All notable changes to the Comment Doc Links extension are documented in this
file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  `## src/file.js — ` in Markdown headings.
- Legacy heading separators tolerated when parsing existing documents:
  ` - ` and `#`.
- Unit tests for parsers, resolvers, diagnostics and suggestions.

### Changed

- Refactored navigation, resolution, diagnostics and completion into focused
  modules under `src/`.

## [0.0.1] - 2026-07-10

### Added

- Initial prototype: clickable links between source comments and Markdown
  documentation.
