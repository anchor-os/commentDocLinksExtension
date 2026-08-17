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
// See ticketnumber-78305       — configurable ticket link (opens your tracker)
// Uses API:Checkout   — API reference
```

Issue and API references open an informational panel explaining that the target
is tracked by an external system. Ticket links are configured through
`commentDocLinks.ticketLinks` and open the matching URL directly in your
browser.

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

## Editions

Comment Doc Links is implemented for two families of editors. Both implement
the same specification and the same reference syntax described above — they are
independent builds that share no code at runtime.

| Editor                          | Implementation            | Package        |
| ------------------------------- | ------------------------- | -------------- |
| Visual Studio Code              | `src/` (TypeScript)       | VSIX extension |
| WebStorm / IntelliJ-based IDEs  | `jetbrains/` (Kotlin)     | Plugin ZIP     |

The VS Code extension lives under `src/` and is packaged as a `.vsix`. The
JetBrains plugin lives under `jetbrains/` (a standalone Gradle/Kotlin project)
and is packaged as a plugin ZIP. The two builds are isolated: the Gradle build
does not depend on npm, and the npm build does not depend on Gradle.

## Requirements

- Visual Studio Code 1.106.0 or newer.
- **WebStorm 2026.2.1 or other IntelliJ-based IDEs** (JetBrains plugin in
  `jetbrains/`).

## Building

### VS Code extension

```sh
npm install
npm run lint        # biome check
npm test            # unit tests
npm run test:e2e    # integration tests (downloads VS Code)
npm run package     # produce the .vsix
```

### JetBrains plugin

The plugin is a standalone Gradle/Kotlin project under `jetbrains/`. The Gradle
toolchain requires **JDK 21** (newer JDKs such as 26 will not satisfy the
configured toolchain), so point `JAVA_HOME` at a JDK 21 install before running
Gradle:

```sh
cd jetbrains
export JAVA_HOME=/opt/homebrew/opt/openjdk@21   # adjust to your JDK 21 path
./gradlew test buildPlugin
```

`buildPlugin` produces the plugin ZIP under `jetbrains/build/distributions/`.

## Extension Settings

This extension contributes the following settings:

| Setting                                 | Default | Description                                          |
| --------------------------------------- | ------- | ---------------------------------------------------- |
| `commentDocLinks.enableDecorations`     | `true`  | Highlight recognized references in the editor.       |
| `commentDocLinks.linkColor`             | `theme` | Color of valid references: `theme` or any CSS color. |
| `commentDocLinks.linkUnderline`         | `true`  | Underline valid reference highlights.                |
| `commentDocLinks.enableDiagnostics`     | `true`  | Report broken references as editor warnings.         |
| `commentDocLinks.enableCompletion`      | `true`  | Suggest anchors while typing.                        |
| `commentDocLinks.ticketLinks`           | `[]`    | External ticket links: `[{ baseUrl, pattern, label? }]`. Each `pattern` is a regex for a ticket key (e.g. `ticketnumber-\d+`); the match is appended to `baseUrl` and opened in the browser. |
| `commentDocLinks.lint.enabled`          | `true`  | Enable `custom-biome-lint` IDE linting (requires the package to be installed). |
| `commentDocLinks.lint.autoDetect`       | `true`  | Auto-detect `custom-biome-lint` per file/workspace. Disable to turn linting fully off. |

## Commands

| Command                             | Title              | Invoked by                                                    |
| ----------------------------------- | ------------------ | ------------------------------------------------------------- |
| `commentDocLinks.openReference`     | Open Reference     | Clicking any recognized reference in a source comment         |
| `commentDocLinks.openDocumentation` | Open Documentation | Legacy: clicking a `file.md[#anchor]` or `file.md[:42]` link  |
| `commentDocLinks.openSource`        | Open Source        | Clicking a `## src/file.js — anchor` heading link in Markdown |
| `commentDocLinks.lint.file`         | Custom Biome Lint: Lint Current File | Manual lint of the active JS/JSX file                  |
| `commentDocLinks.lint.restart`      | Custom Biome Lint: Restart          | Re-detect the package and re-lint open files             |
| `commentDocLinks.lint.status`       | Custom Biome Lint: Show Status      | Report whether the package is installed for the active file |

## Custom Biome Lint Integration

The extension can surface lint diagnostics from
[`custom-biome-lint`](https://github.com/anchor-os/custom-biome-lint) — an
ESLint-like experience backed by a Rust lint engine — directly in the editor.

### Requirement

The feature is **optional**. The project must have the package installed:

```bash
npm install --save-dev custom-biome-lint
```

or via yarn/pnpm. The extension uses the **workspace-installed** package; it
does **not** bundle a binary, does **not** auto-install, and does **not**
require a global binary. If `custom-biome-lint` is not installed:

- linting is silently disabled,
- no errors are shown,
- no noisy notifications appear,
- all existing Comment Doc Links features keep working exactly as before.

Detection walks up from the file to the nearest
`node_modules/custom-biome-lint`, so monorepos resolve the correct install and
the correct `package.json` configuration per package.

### Supported files

Linting applies only to JavaScript and JSX:

- `.js` → language `javascript`
- `.jsx` → language `javascriptreact`

Markdown, YAML, Terraform, Velocity, GraphQL and every other supported file
type are **not** linted — the linter is JS/JSX only.

### Diagnostics

When the Rust linter reports a violation:

- `error` → red squiggle,
- `warn` → orange/yellow squiggle.

The diagnostic message names the rule, e.g.:

```text
Use Immutable.js Map instead of native Map.

custom-biome-lint/no-native-map
```

### Quick Fix and Suppression

When the Rust linter supplies a safe fix, a **💡 Apply safe fix** quick fix is
offered and applied via the editor's native undoable edit. When the linter
supplies a suppression edit, a **Suppress &lt;rule&gt;** quick fix inserts the
correct ignore comment, e.g.:

```javascript
// custom-biome-ignore-next-line no-native-map
const map = new Map();
```

The extension never computes fix or suppression placement itself — it applies
exactly the text edits the Rust linter returns.

### Rule configuration stays in `package.json`

Rule severity is owned by the Rust linter via
`ignoreBiomeExtensionRules` in the project's `package.json`:

```json
{
  "ignoreBiomeExtensionRules": {
    "no-native-map": "off",
    "no-for-statement": "warn"
  }
}
```

The extension does **not** re-read or duplicate this configuration; it simply
displays what the linter reports. `off` rules produce no diagnostic.

### Architecture

The Rust linter is the single source of truth. The IDE adapters
(`src/lint/` for VS Code, `jetbrains/src/main/kotlin/.../lint/` for
WebStorm) share the same JSON contract:

```text
custom-biome-lint <file> --format json   →   JSON   →   IDE diagnostics / fixes
```

See [docs/custom-biome-lint-integration.md](docs/custom-biome-lint-integration.md)
for the full contract and architecture assessment.

## Known limitations

- Multi-root workspaces use the first workspace folder for path resolution.
- Source anchors in Markdown headings are validated only for supported
  languages with a known file extension.
- Issue and API references are recognized and explained, but are not linked to
  any external system. Ticket references are linked only when
  `commentDocLinks.ticketLinks` is configured (they open the matching URL in
  your browser).

## Release Notes

See [CHANGELOG.md](CHANGELOG.md). The GitHub Actions release workflow
publishes to the VS Code Marketplace and Open VSX — see
[PUBLISHING.md](PUBLISHING.md).

## License

MIT — see [LICENSE](LICENSE).
