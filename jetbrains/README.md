# Comment Doc Links — JetBrains / WebStorm Plugin

Navigate between source **comments** and **markdown documentation** with two-way links, inside WebStorm and other IntelliJ-based IDEs.

This is the JetBrains port of the [VS Code "Comment Doc Links" extension](https://github.com/anchor-os/commentDocLinksExtension). The two editions are built, tested, and published **independently** — there is no Gradle↔npm coupling.

- **Plugin id:** `com.anchor.commentdoclinks`
- **Package:** `com.anchor.commentdoclinks`
- **Target:** WebStorm 2026.2.1 (and other IntelliJ-platform IDEs)

## Features

| Feature | Form | Example |
|---|---|---|
| Documentation link | `file.md` (+ anchor / line) | `docs/guide.md#checkout-flow`, `docs/guide.md:42`, `docs/guide.md#L42` |
| Issue reference | `#123` | `#123` |
| API reference | `API:Foo` | `API:CartService` |
| Ticket reference | `DOC-123` | `DOC-123` (external) |
| Reverse navigation | `## src/file.js — anchor` heading in markdown | navigates back to the commenting line |

- **Clickable links** (Ctrl/Cmd+Click) and Go-to-Declaration for documentation references.
- **Inline highlighting** of valid/external references (link color).
- **Diagnostics**: missing file / invalid path → error; missing anchor / out-of-range line → warning.
- **Completion**: suggest doc anchors after `file.md#`; suggest source anchors after `## src/file.js — ` in markdown.
- **Configurable** via `commentDocLinks.*` application settings.

## Supported languages

JavaScript, TypeScript, JSX/TSX, GraphQL, Terraform, YAML, Velocity, Markdown, Python, Java, Go, Rust, C, C++, C#, PHP, Ruby, Kotlin, Swift (20 languages).

## Quick start (development)

```bash
cd jetbrains
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
./gradlew buildPlugin      # builds build/distributions/comment-doc-links-jetbrains-0.1.3.zip
./gradlew test             # runs the 97-test suite
./gradlew runIde           # launches a WebStorm sandbox with the plugin installed
```

See [DEVELOPMENT.md](./DEVELOPMENT.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [TESTING.md](./TESTING.md), [PUBLISHING.md](./PUBLISHING.md), [PARITY_MATRIX.md](./PARITY_MATRIX.md), and [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

## Documentation map

| Document | Purpose |
|---|---|
| `README.md` | This file — overview and quick start |
| `ARCHITECTURE.md` | Module layout, layers, and data flow |
| `DEVELOPMENT.md` | Local setup, build, run, conventions |
| `TESTING.md` | How the test suite is structured and run |
| `PUBLISHING.md` | Building, signing, and releasing to the Marketplace |
| `PARITY_MATRIX.md` | VS Code → JetBrains module mapping with status |
| `IMPLEMENTATION_STATUS.md` | Phase/feature completion status |
| `BEHAVIOR_SPEC.md` | Canonical behavior spec (parity reference) |
