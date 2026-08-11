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
specific section, or a line number to jump to a specific line.

```javascript
// See docs/user-guide/checkout.md#checkout-flow
// See docs/user-guide/checkout.md#L42
// See docs/user-guide/checkout.md:42
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

## Features

- Two-way navigation: comments → documentation and documentation → comments.
- Anchors are optional — a missing anchor never blocks opening the target file.
- Exact anchor matching: `checkout` never resolves to
  `checkout-flow`.
- Tolerates legacy separators when parsing existing documents:
  `## src/checkout/cart.js - anchor` and `## src/checkout/cart.js#anchor`.
- Diagnostics highlight references to missing documentation files and anchors
  (conservative — only provably broken references are flagged).
- Completion suggests anchors after `file.md#` in comments and source anchors
  after `## src/file.js —` in Markdown headings.

## Supported languages

- JavaScript / JSX
- TypeScript / TSX
- GraphQL
- Terraform
- YAML
- Velocity
- Markdown

## Requirements

- Visual Studio Code 1.106.0 or newer.

## Extension Settings

None. The extension works automatically on the languages listed above.

## Commands

| Command                             | Title              | Invoked by                                                    |
| ----------------------------------- | ------------------ | ------------------------------------------------------------- |
| `commentDocLinks.openDocumentation` | Open Documentation | Clicking a `file.md[#anchor]` or `file.md[:42]` link in a source comment |
| `commentDocLinks.openSource`        | Open Source        | Clicking a `## src/file.js — anchor` heading link in Markdown |

## Known limitations

- Multi-root workspaces use the first workspace folder for path resolution.
- Source anchors in Markdown headings are validated only for supported
  languages with a known file extension.

## Release Notes

See [CHANGELOG.md](CHANGELOG.md). The GitHub Actions release workflow
publishes to the VS Code Marketplace and Open VSX — see
[PUBLISHING.md](PUBLISHING.md).

## License

MIT — see [LICENSE](LICENSE).
