# Activation and Lifecycle

Activation registers commands, providers, diagnostics, decorations, listeners, and the background scanner.

Expensive initial scanning is deferred to the scheduler so activation stays responsive.

## Lifecycle events

- document opened
- document changed
- document closed
- file created
- file deleted
- file renamed
- configuration changed
- active editor changed

The dependency index is updated as source documents are scanned.

For renames, capture old dependents before removing the old index entry, then scan the new path and re-scan those dependents.
