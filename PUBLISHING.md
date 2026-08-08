# Publishing to the VS Code Marketplace

This repository publishes the **Comment Doc Links** extension to the [VS Code
Marketplace](https://marketplace.visualstudio.com) with **OpenID Connect (OIDC)
trusted publishing** — no Personal Access Token (PAT) is stored anywhere.

## How it works

```
GitHub Release published
      │  (tag v0.1.0, ...)
      ▼
.github/workflows/publish.yml   permissions: contents: read + id-token: write
      │
      ▼
npx @vscode/vsce@next publish --oidc
      │  requests a GitHub Actions OIDC token
      │  audience = marketplace.visualstudio.com
      ▼
VS Code Marketplace (_apis/gallery/token) validates the token against the
configured trusted publishing policy and returns a short-lived credential
```

- The GitHub Actions OIDC token is exchanged directly for a short-lived
  Marketplace credential. `vsce` does **not** fall back to a PAT if the token
  exchange fails.
- Because `id-token: write` is only granted on the `publish` job of this
  workflow, no other workflow in this repository can impersonate the publisher.
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

## Publishing a release

1. Bump the version in `package.json` (SemVer).
2. Update `CHANGELOG.md` (Keep a Changelog format).
3. Commit and push to `main` (CI runs: lint, unit tests, integration tests,
   VSIX packaging).
4. Create a tag matching the package version, e.g. `v0.1.1`.
5. Create a GitHub Release from that tag (any title/notes).
6. `publish.yml` triggers on `release: published`, re-runs the checks, verifies
   the tag matches `package.json`, packages the VSIX, and publishes it to the
   Marketplace.

The workflow refuses to publish when the release tag does not match the
`package.json` version, and `vsce` refuses to republish a version that already
exists on the Marketplace (no `--skip-duplicate`).

## Manual trigger

The workflow also accepts `workflow_dispatch`. A manual run skips the
tag/version consistency check and publishes the current `package.json` version.
This is useful for testing after the trust policy is configured, and for
re-publishing an unpublish step or a Marketplace rollback.

## Requirements and notes

- `--oidc` currently ships on the `@vscode/vsce@next` dist-tag only; `latest`
  (3.9.x) still requires `--pat` or `--azure-credential`. The workflow pins
  `@vscode/vsce@next` until `--oidc` reaches `latest`, then the pin can be
  dropped.
- Requires Node.js >= 22.
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
| `Version ... already exists` | The version was already published; bump `package.json` or unpublish the old one. |
| Release tag mismatch error | The release tag must equal `v<package.json version>`. |
