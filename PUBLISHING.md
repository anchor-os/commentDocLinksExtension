# Publishing to the VS Code Marketplace and Open VSX

This repository publishes the **Comment Doc Links** extension to the [VS Code
Marketplace](https://marketplace.visualstudio.com) and
[Open VSX](https://open-vsx.org) using **two separate GitHub Actions
workflows**, so each registry can be published independently:

- `.github/workflows/publish.yml` — VS Code Marketplace, using **OpenID Connect
  (OIDC) trusted publishing** (no Personal Access Token stored anywhere).
- `.github/workflows/publish-openvsx.yml` — Open VSX, using an `OVSX_PAT` token
  stored as a GitHub Actions environment secret. This workflow can be triggered
  on its own.

## How it works

```text
GitHub Release published
      │  (tag v0.1.1, ...)
      ├──────────────────────────────────────┬───────────────────────────────┐
      ▼                                      ▼                               │
┌─────────────────────────┐   ┌──────────────────────────┐                  │
│ publish.yml             │   │ publish-openvsx.yml      │   manual "Run    │
│ VS Code Marketplace     │   │ Open VSX                 │   workflow"      │
├─────────────────────────┤   ├──────────────────────────┤   (Open VSX      │
│ build job:              │   │ build+package, then      │   only)          │
│  lint, tests, tag       │   │ ovsx publish             │                  │
│  check, package vsix    │   │ extension.vsix           │                  │
│  → publish job:         │   │   OVSX_PAT from the      │                  │
│  vsce --oidc            │   │   marketplace-publish    │                  │
└────────────┬────────────┘   │   environment secret     │                  │
             │                └────────────┬─────────────┘                  │
             ▼                             ▼                                │
   VS Code Marketplace              Open VSX Registry                        │
```

- The two workflows are **fully independent**: a release triggers both, and the
  Open VSX workflow can also be run **manually** (Actions → "Publish to Open
  VSX" → **Run workflow**) to publish Open VSX on its own.
- Each workflow builds and publishes its own `extension.vsix`; neither depends
  on the other's build artifact.

- The GitHub Actions OIDC token is exchanged directly for a short-lived
  Marketplace credential. `vsce` does **not** fall back to a PAT if the token
  exchange fails.
- The Marketplace trusted-publishing policy restricts publishing to the
  intended repository (`anchor-os/commentDocLinksExtension`) and workflow
  (`publish.yml`). The `id-token: write` permission on the publish job lets
  GitHub mint the OIDC token; it is not itself the authorization mechanism.
- No repository secrets (`VSCE_PAT`, `AZURE_DEVOPS_PAT`, client secrets) are
  used.

## One-time setup (required before the first publish)

A publisher owner of `manish-sharma-getanchorio` must grant this repository
the right to publish:

1. Sign in to the [Visual Studio Marketplace publisher management
   page](https://marketplace.visualstudio.com/manage/publishers/manish-sharma-getanchorio).
2. Open the publisher's **Trusted publishers** (trusted publishing) settings.
3. Add a trusted publishing policy that allows:
   - Repository: `anchor-os/commentDocLinksExtension`
   - Workflow: `publish.yml`
4. Save.

Until this policy exists, the publish job fails with an error from the
Marketplace token-exchange endpoint (the token is valid, but no trust policy
matches it). Once configured, publishing is fully automated.

## Open VSX publishing

Open VSX publishing lives in its own workflow,
[`.github/workflows/publish-openvsx.yml`](.github/workflows/publish-openvsx.yml),
so it can run independently of the Marketplace workflow. It is triggered:

- **Automatically** on every published release (`release: published`), in
  parallel with the Marketplace workflow.
- **Manually** at any time (Actions → "Publish to Open VSX" → **Run
  workflow**), to publish Open VSX on its own — for example when the
  Marketplace OIDC endpoint is unavailable or the Marketplace flow is not yet
  configured. Manual runs publish a specific release **tag**: select that tag
  (e.g. `v0.1.1`) in the **Branch** dropdown of the Run workflow dialog, and
  enter the same tag in the required `release_ref` input. The workflow checks
  out that exact tag and refuses to publish unless it matches the
  `package.json` version.

  The Branch dropdown must point at the **tag**, not `main`: the
  `marketplace-publish` environment only allows deployment from `v*` tags, so a
  manual run dispatched from a branch is blocked before any step runs (GitHub
  evaluates the environment policy against the run's ref, not the checkout
  ref). The tag itself points to the tagged commit on `main` — publishing never
  cuts or uses a working branch.

The workflow checks out the code, runs lint and unit tests, verifies the
selected ref (the release tag, or the `release_ref` input on manual runs)
matches the `package.json` version, packages
`extension.vsix` with `npm run package`, and publishes it to the
[Open VSX Registry](https://open-vsx.org) using the official
[ovsx](https://www.npmjs.com/package/ovsx) CLI, pinned to `ovsx@1.1.1` in the
committed tooling manifest `.github/openvsx-publish` (`package.json` +
`package-lock.json`). The CLI is installed with `npm ci --ignore-scripts` in a
step that does not expose `OVSX_PAT`; the publish step then runs the installed
binary with the token in the environment.

- Open VSX authenticates with the **`OVSX_PAT`** access token, stored as a
  GitHub Actions **environment secret** on the `marketplace-publish`
  environment. It never appears in workflow files, `package.json`, `.env`,
  repository files, command-line arguments, or logs. Eclipse account
  credentials and passwords are never stored in GitHub.
- Publishing happens on `release: published` and on manual dispatch only —
  never on push, pull requests, or `main` pushes.
- **Duplicate versions fail loudly.** `ovsx publish` rejects an
  already-published version, and the workflow deliberately does **not** pass
  `--skip-duplicate`, so re-publishing an existing version fails instead of
  silently doing nothing. This matches the VS Code Marketplace workflow, which
  also refuses to republish an existing version.

### One-time setup (required before the first Open VSX publish)

1. Create an Open VSX account and log in to the
   [Open VSX Registry](https://open-vsx.org).
2. Create an Open VSX **access token** (personal access token) in the Open VSX
   user settings. This token is required both to create the namespace and to
   publish.
3. Create the Open VSX namespace that corresponds to the extension publisher in
   `package.json` (`manish-sharma-getanchorio`). First install the pinned CLI
   with lifecycle scripts disabled and `OVSX_PAT` **unset**:
   `(cd .github/openvsx-publish && npm ci --ignore-scripts)`, then create the
   namespace from the repository root with the installed binary. Supply the
   token without placing it in the shell command or shell history — for
   example via a secure prompt or your secret manager:
   `read -r -s OVSX_PAT`
   `export OVSX_PAT`
   `./.github/openvsx-publish/node_modules/.bin/ovsx create-namespace manish-sharma-getanchorio`
   `unset OVSX_PAT`
4. Sign the required **Open VSX Publisher Agreement** (this is separate from
   the Eclipse Contributor Agreement) and **claim ownership** of the namespace
   by opening a GitHub issue in
   [EclipseFdn/open-vsx.org](https://github.com/EclipseFdn/open-vsx.org), per
   the
   [Namespace Access wiki](https://github.com/eclipse-openvsx/openvsx/wiki/Namespace-Access).
   Until ownership is granted, any user can publish under the namespace — do
   **not** publish the first release before Open VSX grants ownership.
5. Add the token to GitHub under the existing `marketplace-publish` environment:
   - Environment: `marketplace-publish`
   - Secret name: `OVSX_PAT`

Do not store the token value in this document or anywhere in the repository.

## Publishing a release

1. Bump the version in `package.json` (SemVer).
2. Update `CHANGELOG.md` (Keep a Changelog format).
3. Commit and push to `main` (CI runs: lint, unit tests, integration tests,
   VSIX packaging).
4. Create a tag matching the package version, e.g. `v0.1.1`.
5. Create a GitHub Release from that tag (any title/notes).
6. A published release triggers **both** workflows in parallel:
   - `publish.yml` re-runs the checks, verifies the tag matches `package.json`,
     packages the VSIX, and publishes it to the VS Code Marketplace with
     `vsce --oidc`.
   - `publish-openvsx.yml` re-runs the checks, packages the VSIX, and publishes
     it to Open VSX with `ovsx`.
   To publish **only** Open VSX (without the Marketplace), use the manual **Run
   workflow** button on `publish-openvsx.yml` instead of creating a release:
   select the release tag in the **Branch** dropdown and enter the same tag in
   the `release_ref` input.

The workflow refuses to publish when the selected ref (the release tag, or the
`release_ref` input on manual runs) does not match the `package.json` version,
and `vsce` refuses to republish a version that already
exists on the Marketplace (no `--skip-duplicate`). Open VSX likewise rejects an
already-published version.

## Requirements and notes

- `--oidc` ships on `@vscode/vsce@3.9.3-4` only; `latest` (3.9.x) still
  requires `--pat` or `--azure-credential`. The publish job pins the exact
  `@vscode/vsce@3.9.3-4` version until `--oidc` reaches `latest`, then the pin
  can be relaxed.
- The Open VSX workflow pins `ovsx@1.1.1` (current stable) in the committed
  tooling manifest `.github/openvsx-publish` (`package.json` +
  `package-lock.json`) and installs with `npm ci --ignore-scripts` in a step
  without `OVSX_PAT`; it requires Node >= 20, satisfied by the Node 26.4.0
  setup step.
- Requires Node.js 26.4.0 (also satisfies vsce's Node >= 22 requirement).
- `--azure-credential` (Entra ID workload identity federation) is the
  alternative PAT-free path documented by Microsoft, but it is aimed at Azure
  Pipelines and fails for GitHub Actions against personally-owned publishers
  (microsoft/vscode-vsce#1023). The direct `--oidc` flow above avoids that
  dependency entirely.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Publish fails on `/_apis/gallery/token` | Trusted publishing policy not configured for this repo+workflow. Complete the one-time setup above. |
| `No supported OIDC provider was detected` | `--oidc` requires a GitHub Actions environment with `permissions: id-token: write`. |
| Open VSX publish fails with an authorization error | `OVSX_PAT` is missing, revoked, or deleted, or the token owner is not a member of the `manish-sharma-getanchorio` namespace (the token must belong to a namespace member, not necessarily the owner). Check the secret on the `marketplace-publish` environment. |
| Open VSX publish fails with "namespace not found" | The namespace must exist on Open VSX before the first publish; create it per step 3 of the one-time setup above. |
| Open VSX publish fails with "version already exists" | The version was already published to Open VSX; bump `package.json` or delete the version via **Profile > Settings > Extensions** on open-vsx.org. Deletion is permanent and cannot be undone. If self-service deletion is unavailable, file an issue with the Open VSX project. The job intentionally does not use `--skip-duplicate`. |
| VS Code Marketplace publish fails with `Version ... already exists` | The version was already published on the VS Code Marketplace; bump `package.json` or remove the version via the Marketplace publisher management page. The job intentionally does not use `--skip-duplicate`. |
| Release tag mismatch error | The selected ref (the release tag, or the `release_ref` input on manual runs) must equal `v<package.json version>`. |
| Manual Open VSX run is blocked before any step runs | The **Branch** dropdown selected `main` (a branch); the `marketplace-publish` environment only allows `v*` tags. Re-run selecting the release tag in the **Branch** dropdown and matching `release_ref`. |
| Manual Open VSX run fails with `release_ref` validation error | `release_ref` must be exactly `v<package.json version>` and must exist as a tag in the repository. |
| Manual Open VSX run fails because `release_ref` does not match the selected ref | The **Branch** dropdown tag and the `release_ref` input must be identical (e.g. both `v0.1.1`). The workflow refuses to publish a tag that differs from the one selected in the Run-workflow dialog. |
