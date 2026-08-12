# Architectural Decisions

## Shared normalized references
Parsing is separated from consumers so every feature does not need to understand every syntax form.

## Shared resolver
Navigation, diagnostics, hover, and decorations agree on path and anchor semantics.

## Worktree-aware roots
The nearest checkout is preferred to prevent links crossing into the wrong worktree.

## Path escape protection
Lexical and physical containment checks protect both correctness and security.

## Dependency indexing
Reverse dependencies avoid rescanning every open document after each target change.

## Background scheduler
Startup scanning is deferred to keep activation responsive.

## Priority scheduling
The active document is most important immediately; referenced targets are also prioritized.

## Async disk versioning
Disk metadata is read asynchronously in background scanning.

## Unsaved-document precedence
Open in-memory text represents what the user actually sees.

## Conservative diagnostics
Uncertain cases are skipped rather than producing false positives.
