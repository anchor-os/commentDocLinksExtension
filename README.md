# Comment Doc Links

Navigate between source comments and Markdown documentation with two-way links.
[getanchor.io](https://getanchor.io)
In a source file, a comment can point at a specific section of a Markdown
document. In the Markdown document, a heading can point back at the source
comment. Click the link in either place and the extension opens the target
file and reveals the exact line.

## How it works

### Source comment → Markdown documentation

Write the documentation file path in a comment. Add an anchor to link to a
specific section, a line number to jump to a specific line, or a GitHub-style
heading slug.

```javascript
// See docs/user-guide/checkout.md#checkout-flow
// See docs/user-guide/checkout.md#L42
// See docs/user-guide/checkout.md:42
// See docs/user-guide/checkout.md#checkout-flow  (GitHub-style slug)
function placeOrder(items) { ... }
```

The reference is shown as a link. Clicking it opens
`docs/user-guide/checkout.md` and reveals the matching section or line.
Without an anchor, the documentation file is opened at its top.

### Markdown heading → Source comment

Use a heading whose text names a source file, followed by the em dash and the
anchor used in the source comment.

```markdown
## src/checkout/cart.js — checkout-flow
```

Clicking the source file part opens `src/checkout/cart.js` and reveals the comment
that references `docs/...md#checkout-flow`. If the anchor
cannot be found, the source file is still opened.

### Issue, ticket and API references

Recognized references that have no local target are still detected, decorated
and explained on hover:

```javascript
// Fixes #123          — issue reference
// See DOC-567         — documentation ticket
// Uses API:Checkout   — API reference
```

These links open an informational panel explaining that the target is tracked
by an external system.

## Features

- Two-way navigation: comments → documentation and documentation → comments.
- Anchors are optional — a missing anchor never blocks opening the target file.
- Exact anchor matching: `checkout` never resolves to
  `checkout-flow`.
- Anchors resolve to explicit documentation headings, HTML anchors
  (`<a id="anchor"></a>`), and GitHub-style slugs of plain Markdown headings.
- Tolerates legacy separators when parsing existing documents:
  `## src/checkout/cart.js - anchor` and `## src/checkout/cart.js#anchor`.
- Hover shows the resolution status of every recognized reference.
- Theme-aware highlighting: valid references use VS Code's link color, broken
  ones use the theme's error/warning colors. Fully configurable.
- Diagnostics highlight references to missing documentation files, missing
  anchors and out-of-range lines (conservative — only provably broken
  references are flagged).
- Completion suggests anchors after `file.md#` in comments and source anchors
  after `## src/file.js —` in Markdown headings.
- References resolve against the nearest git checkout root, so links work
  inside linked git worktrees.

## Supported languages

- JavaScript / JSX
- TypeScript / TSX
- GraphQL
- Terraform
- YAML
- Velocity
- Markdown
- Python
- Java
- Go
- Rust
- C
- C++
- C#
- PHP
- Ruby
- Kotlin
- Swift

## Requirements

- Visual Studio Code 1.106.0 or newer.

## Extension Settings

This extension contributes the following settings:

| Setting                                 | Default | Description                                          |
| --------------------------------------- | ------- | ---------------------------------------------------- |
| `commentDocLinks.enableDecorations`     | `true`  | Highlight recognized references in the editor.       |
| `commentDocLinks.linkColor`             | `theme` | Color of valid references: `theme` or any CSS color. |
| `commentDocLinks.linkUnderline`         | `true`  | Underline valid reference highlights.                |
| `commentDocLinks.enableDiagnostics`     | `true`  | Report broken references as editor warnings.         |
| `commentDocLinks.enableCompletion`      | `true`  | Suggest anchors while typing.                        |

## Commands

| Command                             | Title              | Invoked by                                                    |
| ----------------------------------- | ------------------ | ------------------------------------------------------------- |
| `commentDocLinks.openReference`     | Open Reference     | Clicking any recognized reference in a source comment         |
| `commentDocLinks.openDocumentation` | Open Documentation | Legacy: clicking a `file.md[#anchor]` or `file.md[:42]` link  |
| `commentDocLinks.openSource`        | Open Source        | Clicking a `## src/file.js — anchor` heading link in Markdown |

## Known limitations

- Multi-root workspaces use the first workspace folder for path resolution.
- Source anchors in Markdown headings are validated only for supported
  languages with a known file extension.
- Issue, ticket and API references are recognized and explained, but are not
  linked to any external system.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md). The GitHub Actions release workflow
publishes to the VS Code Marketplace and Open VSX — see
[PUBLISHING.md](PUBLISHING.md).

## License

MIT — see [LICENSE](LICENSE).
