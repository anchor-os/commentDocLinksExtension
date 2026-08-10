# Publishing to the VS Code Marketplace and Open VSX

This repository publishes the **Comment Doc Links** extension to the [VS Code
Marketplace](https://marketplace.visualstudio.com) with **OpenID Connect (OIDC)
trusted publishing** — no Personal Access Token (PAT) is stored anywhere — and
to [Open VSX](https://open-vsx.org) from GitHub Actions using an `OVSX_PAT`
token stored as a GitHub Actions environment secret.

## How it works

```text
GitHub Release published
      │  (tag v0.1.1, ...)
      ▼
.github/workflows/publish.yml   build job: contents: read
      │
      ├───────────────┬────────────────────────────┐
      ▼               ▼                            ▼
   build           publish                     publish-openvsx
   job             (Marketplace)               (Open VSX)
      │               │                            │
      ▼               ▼                            ▼
extension.vsix    vsce --oidc                  ovsx publish extension.vsix
   uploads           │  GitHub Actions OIDC       │  OVSX_PAT from the
   artifact          │  token, audience =         │  marketplace-publish
      │              │  marketplace.visualstudio  │  environment secret
      ▼              ▼  .com                      ▼
      └──────▶ VS Code Marketplace         Open VSX Registry
                  (_apis/gallery/token)
```

- Both publishing jobs run **independently** after the build job and publish the
  **same `extension.vsix`** artifact produced by the build job. The Open VSX job
  never repackages the extension.
- The VS Code Marketplace job (OIDC trusted publishing) and the Open VSX job do
  not depend on each other, so Open VSX publishing continues even if the
  Marketplace token-exchange endpoint is unavailable.

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

The **`publish-openvsx`** job publishes the exact `extension.vsix` produced by
the build job to the [Open VSX Registry](https://open-vsx.org) using the
official [ovsx](https://www.npmjs.com/package/ovsx) CLI, pinned to `ovsx@1.1.1`
in the committed tooling manifest `.github/openvsx-publish` (`package.json` +
`package-lock.json`). The workflow installs it with `npm ci --ignore-scripts` in
a step that does not expose `OVSX_PAT`; the publish step then runs the installed
binary with the token in the environment.

- The same VSIX artifact is used for both registries: build → `extension.vsix`
  → upload artifact → download artifact → `ovsx publish extension.vsix`. The
  Open VSX job does **not** run `npm run package` again.
- Publishing happens from GitHub Actions in the `publish.yml` workflow, on
  `release: published` only — never on push, pull requests, or `main` pushes.
- Open VSX authenticates with the **`OVSX_PAT`** access token. The token is a
  GitHub Actions **environment secret** on the existing `marketplace-publish`
  environment and is available only to the Open VSX publishing job. It never
  appears in workflow files, `package.json`, `.env`, repository files,
  command-line arguments, or logs. Eclipse account credentials and passwords are
  never stored in GitHub.
- Open VSX publishing is independent of Marketplace publishing: `publish-openvsx`
  depends only on `build`, so it is not blocked if the Marketplace OIDC endpoint
  is unavailable.
- **Duplicate versions fail loudly.** `ovsx publish` rejects an
  already-published version, and the job deliberately does **not** pass
  `--skip-duplicate`, so re-publishing an existing version fails the release
  instead of silently doing nothing. This matches the VS Code Marketplace job,
  which also refuses to republish an existing version.

### One-time setup (required before the first Open VSX publish)

1. Create an Open VSX account and log in to the
   [Open VSX Registry](https://open-vsx.org).
2. Create an Open VSX **access token** (personal access token) in the Open VSX
   user settings. This token is required both to create the namespace and to
   publish.
3. Create the Open VSX namespace that corresponds to the extension publisher in
   `package.json` (`manish-sharma-getanchorio`). First install the pinned CLI
   with lifecycle scripts disabled and `OVSX_PAT` **unset**:
   `npm ci --ignore-scripts` (in `.github/openvsx-publish`), then create the
   namespace with the installed binary and the token set as `OVSX_PAT`:
   `OVSX_PAT=<token> ./.github/openvsx-publish/node_modules/.bin/ovsx create-namespace manish-sharma-getanchorio`
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
6. `publish.yml` triggers on `release: published`. The non-privileged `build`
   job re-runs the checks, verifies the tag matches `package.json`, packages
   the VSIX, and uploads it as an artifact. The `publish` job then downloads
   the artifact and publishes it to the VS Code Marketplace, and the
   `publish-openvsx` job downloads the same artifact and publishes it to Open
   VSX. The two publish jobs run independently of each other.

The workflow refuses to publish when the release tag does not match the
`package.json` version, and `vsce` refuses to republish a version that already
exists on the Marketplace (no `--skip-duplicate`). Open VSX likewise rejects an
already-published version.

## Requirements and notes

- `--oidc` ships on `@vscode/vsce@3.9.3-4` only; `latest` (3.9.x) still
  requires `--pat` or `--azure-credential`. The publish job pins the exact
  `@vscode/vsce@3.9.3-4` version until `--oidc` reaches `latest`, then the pin
  can be relaxed.
- The Open VSX job pins `ovsx@1.1.1` (current stable) in the committed tooling
  manifest `.github/openvsx-publish` (`package.json` + `package-lock.json`) and
  installs with `npm ci --ignore-scripts` in a step without `OVSX_PAT`; it
  requires Node >= 20, satisfied by the Node 26.4.0 setup step.
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
| `Version ... already exists` | The version was already published; bump `package.json` or unpublish the old one. |
| Release tag mismatch error | The release tag must equal `v<package.json version>`. |
