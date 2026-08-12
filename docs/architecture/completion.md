# Completion

Completion is context-sensitive and configuration-gated.

## Comment completion
For `file.md#`, resolve the Markdown file, read it, list anchors, and return completion items for the partial anchor.

## Markdown completion
For a source heading such as `## src/example.js —`, resolve the source, parse it, list source anchors, and return completion items.

Multiline comment state is tracked so completion works inside block comments.
