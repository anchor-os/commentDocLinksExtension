# Custom Biome Lint Integration — Architecture & Contract

This document records the Phase 0 investigation findings and the internal
lint contract for adding `custom-biome-lint` IDE support to the existing
Comment Doc Links extension. The goal is an ESLint-like experience driven
entirely by the Rust linter; the extension never re-implements a rule.

## 1. Investigation summary

The extension is a single VS Code extension (`src/extension.js`,
`onStartupFinished`) plus a parallel JetBrains/WebStorm plugin under
`jetbrains/`. The existing VS Code architecture:

- **Providers** are registered once in `activate()`: document-link
  providers (comments + markdown), a hover provider
  (`ReferenceHoverProvider`), a decoration provider, and completion
  providers. Selection is driven by `documentSelector()` in
  `src/parsers/languageSupport.js`, which supports many languages
  (js, jsx, ts, tsx, yaml, terraform, graphql, velocity, …).
- **Diagnostics** live in a dedicated collection created with
  `vscode.languages.createDiagnosticCollection("commentDocLinks")` and
  managed by `DiagnosticsManager`. Broken-reference warnings are computed
  synchronously from the in-memory document.
- **Scheduling** is a bounded-concurrency priority queue
  (`ScanScheduler`) used for background reference scanning. It is coupled
  to document-scanning deps and is *not* reused for linting; lint gets its
  own lightweight debounce + request-id guard instead (see §4).
- **Configuration** is read through `src/config/configuration.js`
  (`getConfiguration()`), mirrored in `package.json`
  `contributes.configuration` under the `commentDocLinks` section.
- **Commands** are registered in `activate()` via
  `registerXCommand(context)` helpers; IDs live in `src/constants.js`.
- **Tests**: `node --test test/unit/*.test.js` runs pure-logic unit tests
  **without the VS Code host** — any module imported by a unit test must
  not `import * as vscode from "vscode"`. E2E uses `@vscode/test-electron`.

Key constraint: **custom-biome-lint is a separate package/repo and is not
bundled.** The feature is *optional* — when the package is absent from a
workspace, no lint process runs and nothing errors or nags.

## 2. Lint subsystem layout (new, isolated)

```text
src/lint/
  installation.js        # detect + resolve custom-biome-lint (NO vscode)
  LintResultParser.js     # JSON -> LintResult (NO vscode)
  LintRunner.js           # execute CLI, return stdout/exit (NO vscode)
  LintDiagnosticMapper.js # LintResult -> plain diagnostic descriptors (NO vscode)
  LintCodeActionProvider.js # vscode.CodeActionProvider (fix + suppression)
  LintHoverProvider.js    # vscode.HoverProvider (lint info)
  LintConfig.js           # config keys + resolve (NO vscode, pure)
  ruleDocumentation.js    # central rule -> docs URL map (NO vscode)
  LintManager.js          # orchestration; takes an injected LintHost (NO vscode)
  LintProvider.js         # LintProvider contract (CustomBiomeLintProvider)
  CustomBiomeLintProvider.js # implements LintProvider via runner+installation
```

`LintManager` imports **no** `vscode`. All IDE interaction is funneled
through an injected `LintHost` interface (collection setter, output
channel, window messaging, command registration hooks). `extension.js`
supplies the real `LintHost`. This keeps the manager fully unit-testable
and keeps the rest of the extension unaware of `child_process`/CLI details.

## 3. LintProvider contract

```js
interface LintProvider {
  isAvailable();                       // -> boolean (package installed here)
  lint({ file, cwd, text?, signal });  // -> Promise<LintResult>
  dispose();
}
```

`CustomBiomeLintProvider` implements it using `installation.js` (resolve
executable) + `LintRunner` (spawn) + `LintResultParser`. The manager talks
only to this interface, so a future provider can be swapped in without
touching VS Code wiring.

## 4. Lifecycle, debounce, stale protection

- Lint runs **only** for `javascript` / `javascriptreact` documents
  (`.js` / `.jsx`). All other supported file types (md, yaml, tf, vtl,
  graphql, …) are skipped — the linter is JS/JSX only.
- Triggers: open, save, and a debounced `onDidChangeTextDocument`
  (`LINT_DEBOUNCE_MS = 250`). Close clears diagnostics.
- Each lint request carries a monotonic `requestId` per document URI.
  Results are published **only** if the request is still the latest for
  that URI — older in-flight results are dropped (Phase 13). The linter
  runs with `cwd` set to the **package.json nearest to the linted file**
  (not to wherever the binary lives), so config discovery via
  `package.json` / `ignoreBiomeExtensionRules` works in monorepos even when
  the binary is hoisted to a root `node_modules`.
- Diagnostics use a **separate** collection
  `createDiagnosticCollection("custom-biome-lint")` so clearing lint never
  touches the `commentDocLinks` collection (Phase 18).

## 5. Machine-readable contract (Rust -> JSON, v1 envelope)

`custom-biome-lint --stdin <virtualPath> --format json`
(preferred: lints the live, unsaved buffer) or
`custom-biome-lint <file> --format json` (run with `cwd` = the
`package.json` nearest to the linted file).

- `stdout` → JSON (a lint result, even when violations exist).
- `stderr` → logs / errors only.
- A non-zero exit because of violations is **not** a crash; only
  unparseable stdout / spawn failure / non-zero with empty stdout is an
  execution error.
- The envelope's `version` must be `1`; the adapter rejects anything else.

```jsonc
{
  "version": 1,
  "files": [
    {
      "path": "src/checkout/cart.js",
      "violations": [
        {
          "rule": "no-native-map",
          "message": "Use Immutable.js Map instead of native Map.",
          "severity": "error",          // "error" | "warning"
          "line": 1, "col": 7,          // 1-based point (always present)
          "startLine": 1, "startColumn": 7,    // 1-based UTF-8 BYTE columns
          "endLine": 1, "endColumn": 14,       // half-open [start, end)
          "docsUrl": "https://.../rules/no-native-map",  // optional
          "fixes": [                        // alternatives; may be empty
            {
              "kind": "safe",              // "safe" | "unsafe"
              "title": "Apply safe fix",
              "edits": [ { "startLine": 1, "startColumn": 7,
                           "endLine": 1, "endColumn": 14,
                           "replacement": "Immutable.Map()" } ]
            }
          ],
          "suppressions": [                // alternatives; may be empty
            {
              "kind": "suppress",
              "title": "Suppress no-native-map",
              "edits": [ { "startLine": 1, "startColumn": 1,
                           "endLine": 1, "endColumn": 1,
                           "replacement": "// custom-biome-ignore-next-line no-native-map\n" } ]
            }
          ]
        }
      ]
    }
  ],
  "summary": null
}
```

Conventions:
- **Lines are 1-based; columns are 1-based UTF-8 *byte* offsets, NOT
  characters and NOT UTF-16.** A multibyte char (`é`, `你`, `😀`) advances
  the byte column by its UTF-8 length. Spans are half-open
  `[startColumn, endColumn)`. `endLine`/`endColumn` are **omitted** for
  line-only rules (the whole line is highlighted). The IDE adapter converts
  these byte columns to native editor offsets (UTF-16 in VS Code, document
  offsets in JetBrains) via `lintUtf16.js` / `ByteOffsetConverter.kt`; it
  never computes placement itself.
- **Off rules never appear** in the output; the Rust linter already applied
  `ignoreBiomeExtensionRules`. The extension never re-reads rule config.
- **`fixes` and `suppressions` are lists of alternative actions.** Each
  action becomes its own Quick Fix / Code Action — they are never merged
  into a single edit set. `safe` fixes are surfaced before `unsafe` ones.
- **Edits are provided by Rust** as exact text (byte-column span +
  `replacement`). The IDE applies them via `WorkspaceEdit` /
  `LocalQuickFix`; it never computes suppression placement.
- **Execution:** a native binary is spawned directly. A `.js` launcher is
  relaunched through the current Node/Electron runtime (`process.execPath`)
  so the same command works on macOS, Linux, and Windows (where spawning a
  `.js` file directly fails).

## 6. IDE mapping

| Rust            | VS Code                         | JetBrains        |
|-----------------|--------------------------------|------------------|
| `error`         | `DiagnosticSeverity.Error`     | `ERROR`          |
| `warn`          | `DiagnosticSeverity.Warning`   | `WARNING`        |
| diagnostic      | `Diagnostic` (source `custom-biome-lint`, `code = rule`) | `Problem` / highlight |
| `fixes`         | one `CodeAction` per action (`safe` first) + `WorkspaceEdit` | one `LocalQuickFix` per action |
| `suppressions`  | one `CodeAction` "Suppress <rule>" per action | one `LocalQuickFix` per action |
| `docsUrl`       | hover "Open rule documentation"| hover / doc link |

Rule documentation URLs are centralized in `ruleDocumentation.js` (one map
+ a configurable base), never hardcoded at call sites.

## 7. Status states

The manager tracks per workspace folder: `NOT_INSTALLED`, `AVAILABLE`,
`RUNNING`, `ERROR`. `NOT_INSTALLED` is silent (no notifications). A
`Custom Biome Lint: Show Status` command surfaces the current state.

## 8. Non-goals respected

No bundled binary, no auto-install, no global-binary requirement, no rule
re-implementation, no duplicate `package.json` rule config, no Markdown/
YAML/Terraform/VTL/GraphQL linting, no second extension.
