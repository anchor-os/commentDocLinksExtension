# E2E Tests

Important scenarios:

1. valid navigation;
2. missing-reference diagnostics;
3. completion in valid contexts;
4. completion absent in invalid contexts;
5. configuration toggles;
6. target edits refresh dependents;
7. deletion refreshes dependents;
8. real `WorkspaceEdit.renameFile()` updates dependencies;
9. worktree resolution.

Rename tests must first prove the dependency graph is populated. Waiting for an initially empty diagnostic collection is unsafe because the extension may simply not have scanned yet.
