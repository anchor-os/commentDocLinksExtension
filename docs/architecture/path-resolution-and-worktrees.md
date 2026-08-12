# Path Resolution and Worktrees

The extension can resolve against the VS Code workspace root and the nearest Git checkout root. The most specific applicable root wins.

Paths are protected in two ways:

1. lexical containment prevents `../` escapes;
2. physical/real-path containment prevents symlinks from escaping the root.

Nonexistent targets remain resolvable by resolving the deepest existing ancestor and appending remaining components.

All local-reference features should use the shared workspace/path-resolution functions.
