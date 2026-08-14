# Task: Build a JetBrains/WebStorm Plugin Alongside the Existing VS Code Extension

## Repository

Repository:

`anchor-os/commentDocLinksExtension`

We already have a mature VS Code extension implemented in JavaScript/TypeScript.

The existing repository is the **behavioral reference implementation**.

We now want to add a complete JetBrains plugin for WebStorm and other IntelliJ-based IDEs.

The JetBrains implementation must live in a new root-level sibling directory:

```text
commentDocLinksExtension/
├── src/                    # existing VS Code extension — DO NOT MOVE
├── test/                   # existing VS Code tests
├── documentation/          # existing documentation
├── .github/
├── package.json
├── README.md
├── CHANGELOG.md
│
└── jetbrains/              # NEW JetBrains plugin
    ├── build.gradle.kts
    ├── settings.gradle.kts
    ├── gradle.properties
    ├── gradlew
    ├── gradlew.bat
    ├── gradle/
    └── src/
        ├── main/
        │   ├── kotlin/
        │   └── resources/
        └── test/
```

Do NOT move the existing VS Code source.

Do NOT convert the existing VS Code extension to Kotlin.

Do NOT mix Kotlin files with `src/`.

The repository should contain two independent implementations:

```text
VS Code implementation
    src/
    package.json
    JavaScript/TypeScript
    VSIX

JetBrains implementation
    jetbrains/
    Kotlin
    IntelliJ Platform
    ZIP plugin
```

---

# IMPORTANT DEVELOPMENT PRINCIPLE

The existing VS Code extension, documentation, test cases, and current repository behavior are the source of truth for functionality.

Before implementing anything:

1. Inspect the entire repository.
2. Read the existing documentation.
3. Inspect the existing VS Code implementation.
4. Inspect the existing tests.
5. Understand all currently supported syntax.
6. Understand the recent additions:
   - `#L42`
   - `#42`
   - `:42`
   - Markdown/source links
   - anchor links
   - worktree support
7. Build a behavioral specification before translating functionality.

Do NOT blindly translate JavaScript into Kotlin.

Translate the **behavior**, architecture, and contracts into idiomatic IntelliJ Platform/Kotlin code.

---

# CORE FUNCTIONAL GOAL

The JetBrains plugin must provide equivalent functionality to the existing VS Code extension.

The extension is called:

`Comment Doc Links`

Its purpose is to connect source-code comments and Markdown documentation.

Examples include:

```text
src/util/salesDashboardV2/getRevenueByBusinessCategory2.js
```

with documentation such as:

```text
documentation/claude/comments/ticketnumber-74995.md
```

and anchors such as:

```text
#reconciliation-guarantee
```

Examples:

```text
Totals reconcile to getRevenue; uncategorized rows kept — see documentation/claude/comments/ticketnumber-74995.md

Totals reconcile to getRevenue; uncategorized rows kept — see documentation/claude/comments/ticketnumber-74995.md#reconciliation-guarantee
```

Markdown references:

```markdown
## src/util/salesDashboardV2/getRevenueByBusinessCategory2.js — reconciliation-guarantee
```

and:

```markdown
## src/util/salesDashboardV2/getRevenueByBusinessCategory2.js#reconciliation-guarantee
```

The JetBrains plugin must resolve these references correctly.

---

# RECENT LINE-NAVIGATION FUNCTIONALITY

The existing extension also supports source/document references with line navigation.

Examples:

```text
#L42
```

```text
#42
```

```text
:42
```

These must be investigated from the existing implementation and tests.

Do NOT assume their exact semantics.

Determine exactly:

- where they are valid
- how they are parsed
- whether they are source links or documentation links
- whether they are zero-based or one-based
- what happens with invalid lines
- what happens when the target file is missing
- whether anchors and lines can coexist
- how multiple reference forms interact

Then reproduce the same behavior in JetBrains.

---

# WORKTREE SUPPORT

The existing implementation has recently been updated to support Git worktrees.

This is critical.

The JetBrains implementation must understand that:

```text
Git repository root
```

is not necessarily the same concept as:

```text
current Git worktree
```

The plugin must resolve paths relative to the correct IntelliJ project/worktree.

Inspect the existing VS Code implementation to understand exactly how worktree resolution works.

Do not invent a new behavior.

Test:

```text
main repository
├── worktree-A
└── worktree-B
```

and verify documentation/source references resolve correctly from each worktree.

The JetBrains implementation must not accidentally resolve files against the wrong repository root.

---

# PHASE 0 — CREATE PERSISTENT PROJECT STATE

Before writing implementation code, create:

```text
jetbrains/IMPLEMENTATION_STATUS.md
```

This file is the persistent state for this multi-context development task.

It must contain:

```markdown
# JetBrains Plugin Implementation Status

## Overall Status

Phase 0 — In progress

## Completed

- [ ]

## Current Phase

Phase 0

## Current Task

...

## Next Task

...

## Known Decisions

...

## Known Compatibility Requirements

...

## Known Bugs

...

## Tests Added

...

## Tests Still Required

...

## Files Created

...

## Files Modified

...

## Do Not Change

...

## Behavioral Differences From VS Code

...

## Open Questions

...
```

Update this file after every phase.

This is mandatory because development may continue across multiple AI context windows.

At the end of every compaction/context boundary, update this file before stopping.

---

# PHASE 1 — FULL REPOSITORY AUDIT

Do not implement functionality yet.

Inspect:

```text
src/
test/
documentation/
README.md
CHANGELOG.md
package.json
.github/
```

Find all relevant implementation files.

Pay particular attention to:

```text
src/services/
src/constants.js
src/completion/
src/diagnostics/
```

and all parsers/resolvers/providers.

Identify:

- reference syntax
- parsing
- file resolution
- anchor resolution
- line resolution
- diagnostics
- completion
- navigation
- commands
- worktree handling
- caching
- error handling
- supported file extensions
- Markdown parsing
- source-code comment parsing
- configuration
- test behavior

Produce:

```text
jetbrains/BEHAVIOR_SPEC.md
```

This is the behavioral contract for the JetBrains implementation.

Do not add behavior that the VS Code extension does not have unless explicitly documented as a JetBrains-specific adaptation.

---

# PHASE 2 — DEFINE THE JETBRAINS ARCHITECTURE

Create an architecture appropriate for IntelliJ Platform.

Prefer clean separation such as:

```text
jetbrains/
└── src/
    ├── main/
    │   ├── kotlin/
    │   │   └── com/
    │   │       └── anchor/
    │   │           └── commentdoclinks/
    │   │               ├── parser/
    │   │               ├── resolver/
    │   │               ├── navigation/
    │   │               ├── diagnostics/
    │   │               ├── completion/
    │   │               ├── model/
    │   │               ├── services/
    │   │               ├── commands/
    │   │               └── util/
    │   │
    │   └── resources/
    │       └── META-INF/
    │           └── plugin.xml
    │
    └── test/
```

Use Kotlin.

Use IntelliJ Platform APIs idiomatically.

Do not create unnecessary abstraction layers.

Prefer small services with clear responsibilities.

---

# PHASE 3 — BOOTSTRAP A MINIMAL VALID JETBRAINS PLUGIN

Create a valid IntelliJ Platform plugin project.

It must:

- build successfully
- run in a development IDE
- load without plugin errors
- have valid `plugin.xml`
- have correct plugin ID
- have correct name
- have vendor information
- define compatible IntelliJ platform requirements
- be compatible with WebStorm
- be packaged successfully

Do not implement all functionality yet.

First prove:

```text
./gradlew build
```

works.

Then prove:

```text
./gradlew runIde
```

can launch a development IDE with the plugin.

Add this to `IMPLEMENTATION_STATUS.md`.

---

# PHASE 4 — MODEL THE CORE DOMAIN

Create Kotlin domain models for concepts such as:

```text
DocumentReference
SourceReference
AnchorReference
LineReference
ResolvedReference
ResolutionResult
```

Use immutable data classes where appropriate.

The model should be able to represent:

```text
file
anchor
line
source/document direction
original text
```

Avoid leaking IntelliJ PSI/editor objects into pure parsing models.

The parser should be testable without launching IntelliJ whenever possible.

---

# PHASE 5 — PORT THE PARSER

Implement parsing behavior equivalent to the VS Code extension.

Supported examples must include the exact forms found in the existing implementation.

At minimum investigate:

```text
foo.md
foo.md#anchor
foo.md#L42
foo.md#42
foo.md:42
```

and Markdown source forms:

```text
## src/foo.js — anchor
## src/foo.js - anchor
## src/foo.js#anchor
```

Do not assume every combination is valid.

Build a parser test matrix from the existing JS tests.

The Kotlin parser tests should be deterministic and independent of the IDE where possible.

---

# PHASE 6 — FILE RESOLUTION

Implement file resolution using IntelliJ's project/VFS APIs.

Requirements:

- project-relative paths
- normalized separators
- relative paths
- correct handling of `./`
- correct handling of `../`
- missing files
- directories
- case sensitivity considerations
- symlinks where relevant
- Git worktrees

Do not use the current process working directory as the project root.

Use the IntelliJ project/VFS model.

---

# PHASE 7 — GIT WORKTREE SUPPORT

This deserves dedicated implementation and tests.

Understand the exact existing VS Code worktree algorithm.

Then implement the equivalent JetBrains behavior.

Test:

```text
repo/
repo/.git/

worktree-A/
worktree-A/.git   # may be a gitfile

worktree-B/
worktree-B/.git   # may be a gitfile
```

The plugin must resolve:

```text
src/foo.js
documentation/foo.md
```

against the correct worktree.

Never assume `.git` is always a directory.

Do not accidentally treat a Git worktree's `.git` file as a normal directory.

---

# PHASE 8 — NAVIGATION

Implement click/navigation behavior using IntelliJ APIs.

Examples:

```text
see documentation/foo.md
```

→ open `foo.md`

```text
see documentation/foo.md#anchor
```

→ open Markdown and navigate to heading/anchor

```text
see documentation/foo.md#L42
```

→ open file and navigate to line 42

```text
see src/foo.js#L42
```

→ open source file at line 42

Implement correct editor positioning.

Remember IntelliJ document offsets and line numbers may use zero-based APIs while user-facing lines are one-based.

The user-visible behavior must match VS Code.

---

# PHASE 9 — MARKDOWN ANCHOR RESOLUTION

Implement Markdown heading/anchor resolution.

Investigate the existing VS Code behavior carefully.

Support the same heading formats and normalization rules.

For example:

```markdown
## reconciliation-guarantee
```

and source-link headings such as:

```markdown
## src/foo.js — reconciliation-guarantee
```

Determine exactly how the existing extension finds the target heading.

Do not implement a generic GitHub Markdown slug algorithm unless the VS Code implementation actually uses that behavior.

Write tests for:

- exact anchors
- heading anchors
- duplicate headings
- missing anchors
- special characters
- punctuation
- case
- whitespace

---

# PHASE 10 — SOURCE COMMENT DETECTION

Use IntelliJ PSI/token/document APIs where appropriate.

The plugin must detect references inside supported source-code comments.

Do not simply regex the entire file if IntelliJ PSI provides a safer way to determine comments.

The goal is:

```text
source code
   ↓
comment
   ↓
reference
   ↓
navigation
```

It must avoid treating arbitrary strings/code as documentation links unless the VS Code implementation does so.

Investigate supported languages from the existing extension.

---

# PHASE 11 — MARKDOWN DETECTION

Implement equivalent behavior for Markdown files.

Recognize the supported Markdown syntax.

Preserve the existing distinction between:

```text
source → documentation
```

and:

```text
documentation → source
```

Do not create false positives for normal Markdown headings.

---

# PHASE 12 — DIAGNOSTICS

Port diagnostics behavior.

Examples:

```text
missing file
missing anchor
invalid line
invalid reference
```

Determine exactly which cases the VS Code extension reports.

Use IntelliJ inspections / annotators appropriately.

Diagnostics should:

- be precise
- not scan excessively
- not freeze the UI
- use correct ranges
- provide useful messages
- avoid duplicate errors

---

# PHASE 13 — COMPLETION / QUICK FIXES

Inspect the VS Code completion implementation.

If the VS Code extension provides completion suggestions, implement equivalent IntelliJ completion.

If it provides quick fixes/actions, implement equivalent IntelliJ intentions or quick fixes.

Do not invent UI behavior merely because IntelliJ supports it.

Behavioral parity comes first.

---

# PHASE 14 — COMMANDS / ACTIONS

Inspect existing VS Code commands.

Port their user-visible behavior to JetBrains actions.

Use IntelliJ Action APIs.

Commands must:

- be discoverable
- work from the correct project
- operate on the current editor/file
- respect worktree resolution

---

# PHASE 15 — TESTING

Create a comprehensive Kotlin test suite.

At minimum:

## Parser tests

Test every supported reference form.

## File resolution tests

Test:

- relative paths
- nested paths
- missing files
- normalized paths
- worktrees

## Anchor tests

Test:

- valid anchors
- missing anchors
- duplicate headings
- special characters
- whitespace
- case behavior

## Line tests

Test (these are line references; `#42` is an anchor, not a line — see §3.3):

```text
#L42
:42
#l42
```

including:

- first line
- last line
- line beyond EOF
- line zero
- negative line
- malformed line
- anchor + line if supported

## Navigation tests

Test the resulting file and line.

## Diagnostics tests

Test exact diagnostic behavior.

## Markdown tests

Test source-reference headings.

## Regression tests

Every bug fixed in VS Code that affects shared behavior should have a corresponding JetBrains regression test.

---

# PHASE 16 — BEHAVIORAL PARITY MATRIX

Create:

```text
jetbrains/PARITY_MATRIX.md
```

Example:

| Feature | VS Code | JetBrains | Test |
|---|---|---|---|
| Markdown source link | ✅ | ⬜ | |
| Markdown anchor | ✅ | ⬜ | |
| `#L42` | ✅ | ⬜ | |
| `#42` | ✅ | ⬜ | |
| `:42` | ✅ | ⬜ | |
| Missing file diagnostic | ✅ | ⬜ | |
| Missing anchor diagnostic | ✅ | ⬜ | |
| Completion | ✅ | ⬜ | |
| Worktree | ✅ | ⬜ | |

Do not mark JetBrains functionality complete until there is a test proving it.

---

# PHASE 17 — PERFORMANCE REVIEW

Review for IntelliJ performance.

Do not:

- scan the entire repository on every keystroke
- repeatedly parse the same Markdown document unnecessarily
- perform blocking filesystem operations on the EDT
- perform Git operations synchronously during typing
- rebuild expensive indexes for every completion request

Use appropriate IntelliJ APIs and caching where needed.

The plugin must remain responsive in large repositories.

Test against a realistic large repository if possible.

---

# PHASE 18 — PACKAGE AND COMPATIBILITY

Configure the plugin for WebStorm and appropriate IntelliJ Platform versions.

Verify:

```text
./gradlew build
```

produces a valid plugin ZIP.

Inspect the generated plugin.

Verify:

- plugin.xml
- plugin ID
- version
- vendor
- compatibility
- dependencies
- required modules

Do not claim support for IDE versions that were not tested.

---

# PHASE 19 — CI/CD

Extend the existing GitHub Actions architecture without breaking VS Code CI.

The repository should eventually have:

```text
GitHub Release
       │
       ▼
   build/test
       │
       ├─────────────────────────┐
       │                         │
       ▼                         ▼
VS Code packaging         JetBrains packaging
       │                         │
       ▼                         ▼
   extension.vsix          plugin.zip
       │                         │
       ├──────────────┐          │
       ▼              ▼          ▼
VS Marketplace     Open VSX   JetBrains Marketplace
```

Important:

The JetBrains build must be isolated from the Node/VS Code build.

Do not make Gradle depend on npm.

Do not make npm depend on Gradle.

The shared release should use the same semantic version where appropriate.

---

# PHASE 20 — JETBRAINS CI BUILD

Add a GitHub Actions job that:

1. checks out the repository
2. sets up the appropriate JDK
3. enters `jetbrains/`
4. runs the Gradle build
5. runs JetBrains tests
6. packages the plugin
7. uploads the plugin ZIP as an artifact

Do not publish to JetBrains Marketplace until the plugin has passed build/test/package validation.

Initially CI should only build and upload the artifact.

---

# PHASE 21 — JETBRAINS MARKETPLACE PUBLISHING

Only after the plugin is stable:

Investigate the current official JetBrains Marketplace publishing mechanism.

Do not invent credentials or commands.

Determine:

- required Marketplace account
- publisher identity
- token mechanism
- GitHub Actions authentication
- required secrets
- recommended Gradle publishing plugin
- version requirements
- signing requirements if applicable

Then add a separate publishing job.

Do not let JetBrains publishing depend on VS Code Marketplace publishing.

The jobs should be independent:

```text
build
 ├── VS Code publish
 ├── Open VSX publish
 └── JetBrains publish
```

---

# PHASE 22 — DOCUMENTATION

Update the root documentation only after the JetBrains implementation is functional.

README should eventually explain:

```text
Supported IDEs

VS Code
WebStorm / IntelliJ-based IDEs
```

Explain that:

- VS Code uses the VS Code extension
- JetBrains IDEs use the JetBrains plugin
- both implement the same Comment Doc Links specification

Do not claim JetBrains support until the plugin actually works.

---

# PHASE 23 — FINAL REVIEW

Perform a complete architecture review.

Check:

## Repository

- [ ] Existing VS Code structure untouched
- [ ] `jetbrains/` isolated
- [ ] no generated files committed unnecessarily
- [ ] no secrets committed
- [ ] no IDE-specific junk committed

## Functionality

- [ ] file links
- [ ] Markdown links
- [ ] anchors
- [ ] line references
- [ ] `#L42`
- [ ] `#42`
- [ ] `:42`
- [ ] diagnostics
- [ ] completion
- [ ] navigation
- [ ] worktrees

## Tests

- [ ] parser
- [ ] resolver
- [ ] anchor
- [ ] line
- [ ] worktree
- [ ] diagnostics
- [ ] navigation
- [ ] regressions

## Build

- [ ] Gradle build
- [ ] plugin ZIP
- [ ] development IDE launch
- [ ] CI build
- [ ] CI artifact

## Documentation

- [ ] behavior specification
- [ ] parity matrix
- [ ] architecture
- [ ] publishing
- [ ] README

---

# STRICT RULES

1. Do not modify existing VS Code behavior while implementing JetBrains.
2. Do not rewrite working JS/TS code just to make it look similar to Kotlin.
3. Do not duplicate tests blindly; convert them into meaningful Kotlin/IntelliJ tests.
4. Do not invent behavior.
5. Existing VS Code implementation + documentation + tests are the behavioral source of truth.
6. If behavior is unclear, inspect the VS Code implementation and tests before deciding.
7. Never silently change semantics.
8. Keep `jetbrains/` independently buildable.
9. Keep Node/npm and Gradle builds independent.
10. Never commit secrets.
11. Never use Eclipse credentials in CI.
12. Do not publish automatically until the plugin passes the full test suite.
13. Update `IMPLEMENTATION_STATUS.md` after every phase.
14. At the end of every context window, leave the repository in a buildable state and update `IMPLEMENTATION_STATUS.md`.
15. If a phase cannot be completed safely, stop at that phase, document the blocker, and continue only after resolving it.
16. Do not skip tests to make progress.
17. Prefer small, reviewable commits/changes.
18. Do not create a second repository unless there is a concrete architectural reason.

---

# DEFINITION OF DONE

The JetBrains implementation is complete only when:

```text
[ ] jetbrains/ is a valid IntelliJ Platform project
[ ] WebStorm can run the plugin
[ ] Kotlin tests pass
[ ] VS Code behavior has been documented
[ ] behavioral parity matrix is complete
[ ] file resolution works
[ ] Markdown resolution works
[ ] anchor resolution works
[ ] #L42 works
[ ] #42 works
[ ] :42 works
[ ] diagnostics work
[ ] completion works where VS Code provides equivalent behavior
[ ] navigation works
[ ] Git worktrees work
[ ] large repositories remain responsive
[ ] Gradle build passes
[ ] plugin ZIP is generated
[ ] GitHub Actions builds the plugin
[ ] plugin artifact is uploaded
[ ] JetBrains Marketplace publishing is separately configured
[ ] documentation is updated
```

Do not declare the task complete merely because the Kotlin project compiles.

The goal is **behavioral parity with the existing Comment Doc Links VS Code extension**, implemented idiomatically for the IntelliJ Platform.