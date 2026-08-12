# Source-to-Documentation References

Source comments can reference Markdown documentation and optional anchors.

The flow is:

```text
comment syntax -> normalized reference -> workspace/worktree resolution -> anchor validation
```

Broken cases include missing documentation, invalid paths, and missing anchors.

Navigation, diagnostics, hover, decorations, and completion should share the same semantics.
