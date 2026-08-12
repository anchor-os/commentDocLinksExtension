# Testing Strategy

Use three layers.

## Unit
Test parsing, path resolution, reference resolution, indexing, scheduling, and scanning without VS Code where possible.

## E2E
Use a real VS Code extension host for document events, diagnostics, completion, navigation, workspace edits, and rename behavior.

## Performance
Measure activation latency separately from deferred background work.

Tests should verify observable behavior and important invariants, not merely reproduce implementation steps.
