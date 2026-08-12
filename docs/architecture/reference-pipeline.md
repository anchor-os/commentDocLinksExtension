# Reference Pipeline

1. **Detect** syntax using language-aware scanners.
2. **Normalize** into a stable reference object.
3. **Build context** using the source document, workspace/worktree root, and filesystem.
4. **Resolve** through the shared resolver.
5. **Consume** the result from navigation, hover, completion, decorations, or diagnostics.
6. **Index** resolved target paths for dependency tracking.

This prevents different features from implementing subtly different reference semantics.
