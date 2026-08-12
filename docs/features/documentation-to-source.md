# Documentation-to-Source References

Markdown headings can reference source files and optional source anchors.

The extension resolves the source against the documentation file's applicable root, reads the source, and validates the requested anchor.

When the requested anchor is not present, source navigation still returns a position: the first unanchored reference to the same documentation file, or the start of the file, reported with `anchorFound: false`. Navigation therefore lands somewhere useful instead of failing.

Completion can list source anchors; diagnostics can report missing source files or anchors — the navigation fallback above does not suppress the corresponding diagnostic.
