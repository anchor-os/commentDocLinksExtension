# Code Map

| Area | Representative files | Responsibility |
|---|---|---|
| Reference types | `src/references/referenceTypes.js` | Stable types/statuses |
| Context | `src/references/vscodeContext.js` | VS Code/filesystem context |
| Resolver | `src/references/resolver.js` | Reference validation |
| Scanner | `src/references/documentScanner.js` | Reference extraction |
| Broken scanner | `src/diagnostics/brokenReferenceScanner.js` | Broken-reference detection |
| Diagnostics | `src/diagnostics/diagnostics.js` | VS Code diagnostics |
| Dependency graph | `src/diagnostics/referenceDependencyIndex.js` | Source/target relationships |
| Background scan | `src/scanning/documentScanning.js` | Scan orchestration |
| Scheduler | `src/scanning/scanScheduler.js` | Priority/concurrency |
| File version | `src/scanning/fileVersion.js` | Freshness |
| Workspace | `src/services/workspace.js` | Root/path resolution |
| Path security | `src/services/pathResolution.js` | Containment/symlinks |
| Navigation | `src/commands/openReference.js` | Open/reveal |
| Completion | `src/completion/completionProvider.js` | Suggestions |
| Parsers | `src/parsers/*` | Language/syntax parsing |
| Configuration | `src/config/*` | Feature settings |

Prefer extending shared semantic layers over duplicating logic in UI consumers.
