# Publishing to the VS Code Marketplace

This repository publishes the **Comment Doc Links** extension to the [VS Code
Marketplace](https://marketplace.visualstudio.com) with **Microsoft Entra ID
workload identity federation** — a user-assigned managed identity, a GitHub
federated credential, and `vsce publish --azure-credential`. No Personal Access
Token (PAT) and no client secret are stored anywhere.

## How it works

```text
GitHub Release published
      │  (tag v0.1.1, ...)
      ▼
.github/workflows/publish.yml
      │  publish job runs in environment `marketplace-publish`
      │  permissions: contents: read + id-token: write
      ▼
azure/login@v2
      │  exchanges the GitHub Actions OIDC token for an Entra ID token
      │  via the federated credential on the user-assigned managed identity
      ▼
npx @vscode/vsce@3.9.2 publish --azure-credential
      │  vsce reads the token through its credential chain
      │  (AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_FEDERATED_TOKEN_FILE)
      ▼
VS Code Marketplace
      │  authorizes the managed identity (publisher member, Contributor role)
      ▼
extension published
```

- The GitHub Actions OIDC token is exchanged for a short-lived Entra ID token
  by `azure/login@v2`; `vsce` never sees a long-lived secret.
- `--oidc` trusted publishing is **not** available on the public Marketplace:
  the `/_apis/gallery/token` endpoint returns 404
  (microsoft/vscode-vsce#1275 is still open). Do not switch back to it.
- No repository secrets other than `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.

## One-time setup (required before the first publish)

A publisher owner of `manish-sharma-getanchorio` must do the following. Steps
1–4 are done by the person who runs the Azure account.

1. **Create a user-assigned managed identity** in Azure
   (portal → Managed Identities → + Create). Any subscription and region work.
   **Do not use an App Registration / service principal**: it authenticates but
   the Marketplace rejects the publish with
   `InvalidAccessException: The requested operation is not allowed`.
2. **Add a federated credential for GitHub Actions** on the managed identity
   (Settings → Federated credentials → + Add credential → *GitHub Actions
   deploying Azure resources*):
   - Organization: `anchor-os`
   - Repository: `commentDocLinksExtension`
   - Entity type: **Environment** (not Branch/Tag — Tag breaks on the next
     release)
   - GitHub environment name: `marketplace-publish`
3. **Add the repo secrets** (Settings → Secrets and variables → Actions):
   - `AZURE_CLIENT_ID` — the managed identity's Client ID
   - `AZURE_TENANT_ID` — the identity's Tenant ID
4. **Create the GitHub environment** `marketplace-publish` (Settings →
   Environments). GitHub auto-creates it on first run, but creating it up front
   matches the federated credential exactly.
5. **Register the identity with Azure DevOps and capture its profile ID**
   (one-time). The publisher management page recognizes neither the managed
   identity's ARM resource ID nor its Entra object ID. Run this once while
   authenticated **as the managed identity** (a throwaway `workflow_dispatch`
   job with `azure/login@v2` works):

   ```
   az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798
   ```

   From the returned JSON, capture the `id` field (the Azure DevOps profile ID).
   The GUID `499b84ac-1321-427f-aa17-267ca6975798` is Azure DevOps' well-known
   Entra app ID and is the same for every identity.
6. **Authorize the identity in the Marketplace** — on the publisher management
   page for `manish-sharma-getanchorio`, add a member using the profile ID from
   step 5 and assign the **Contributor** role. If the search does not find the
   identity, the `id` from step 5 is the only value the UI recognizes.

Until these are done, the publish job fails. Once configured, publishing is
fully automated.

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
   the artifact, logs in to Azure via the federated credential, and publishes
   to the Marketplace with `vsce publish --azure-credential`.

The workflow refuses to publish when the release tag does not match the
`package.json` version, and `vsce` refuses to republish a version that already
exists on the Marketplace.

## Requirements and notes

- `--azure-credential` has been in `vsce` since v2.26.1; the workflow pins the
  current stable `@vscode/vsce@3.9.2` for deterministic builds.
- Requires Node.js 26.4.0 (also satisfies vsce's Node >= 22 requirement).
- Global Azure DevOps PATs are retired on **December 1, 2026**; this setup
  needs no PAT and is unaffected by that retirement.
- The publish job's `environment: marketplace-publish` must match the GitHub
  environment name configured in the federated credential (step 2).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `InvalidAccessException: The requested operation is not allowed` | An App Registration/service principal was used. Only a user-assigned managed identity works. |
| Publish fails with `AADSTS...` or "no credentials found" | `azure/login@v2` did not mint a token. Check `AZURE_CLIENT_ID`/`AZURE_TENANT_ID` secrets and that the federated credential matches org, repo, and environment `marketplace-publish`. |
| Publisher member "not found" when adding the identity | You entered the managed identity's Client ID / object ID / ARM resource ID. Only the Azure DevOps profile `id` from the `az rest profiles/me` call is accepted. |
| Publish fails on `/_apis/gallery/token` | `--oidc` is being used. Switch to `--azure-credential`; trusted publishing is not available on the public Marketplace. |
| `Version ... already exists` | The version was already published; bump `package.json` or unpublish the old one. |
| Release tag mismatch error | The release tag must equal `v<package.json version>`. |
