# Architecture Overview

The extension understands references embedded in source-code comments and Markdown documentation. It provides navigation, hover, completion, decorations, and diagnostics.

```text
VS Code event/document
        |
        v
 parser / scanner
        |
        v
 normalized reference
        |
        v
 shared resolver + workspace context
        |
        +--> navigation
        +--> hover
        +--> completion
        +--> decorations
        +--> diagnostics
        |
        v
 dependency index + background scanner
```

## Boundaries

**Parsing** identifies syntax and creates normalized references.

**Resolution** determines whether a reference is valid, broken, external, or escapes the applicable root (reported as `invalid-path`).

**Presentation** consumes the same semantics for navigation, hover, completion, decorations, and diagnostics.

**Scanning** maintains dependency relationships and performs background indexing.

## Stable model

Reference types currently include `documentation`, `issue`, and `api`.

Resolution statuses include `valid`, `missing-file`, `missing-anchor`, `invalid-line`, `invalid-path`, and `external`.

The key invariant is that one reference has one semantic meaning across all consumers.
