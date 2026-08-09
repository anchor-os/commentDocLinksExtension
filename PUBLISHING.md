# Publishing to the VS Code Marketplace

This branch (`entra-publish-setup`) demonstrates the **Azure DevOps Pipelines +
Microsoft Entra ID** publishing flow — the one Microsoft officially recommends:
an Azure Resource Manager service connection with **Workload Identity
Federation** authenticates a user-assigned managed identity, and
`vsce publish --azure-credential` uses the resulting Entra ID token. No PAT and
no client secret are stored anywhere.

## The three publishing flows (what each branch has)

| Flow | Auth mechanism | Where it lives | Status |
| --- | --- | --- | --- |
| OIDC trusted publishing | GitHub OIDC token → `/_apis/gallery/token` → short-lived Marketplace credential (`vsce publish --oidc`) | `main` (`.github/workflows/publish.yml`) | Fails on the public Marketplace: `/_apis/gallery/token` returns 404 (microsoft/vscode-vsce#1275 is still open) |
| GitHub Actions + managed identity | GitHub OIDC token → Entra token via `azure/login@v2` federated credential on a user-assigned managed identity → `vsce publish --azure-credential` | `azure-publish` (`.github/workflows/publish.yml`) | Not yet configured in Azure (needs a managed identity) |
| Azure DevOps Pipelines + Entra ID | Azure DevOps OIDC token → Entra token via an ARM service connection with Workload Identity Federation → `vsce publish --azure-credential` | **this branch** (`azure-pipelines.yml`) | Not yet configured in Azure (needs an Azure DevOps org, a managed identity) |

Flows 2 and 3 are the same underlying mechanism — Entra ID workload identity
federation — with different OIDC issuers (GitHub Actions vs Azure DevOps
Pipelines). Both are PAT-free and unaffected by the Azure DevOps global PAT
retirement on **December 1, 2026**.

## How this flow works

```text
git tag v0.1.1 / push to main
      ▼
azure-pipelines.yml triggers (main push or v* tag)
      │  Build stage: lint, unit tests, integration tests,
      │  tag check, VSIX packaging, artifact publish
      ▼
Publish stage (tags only) — task: AzureCLI@2
      │  uses the ARM service connection (Workload Identity Federation)
      │  to get an Entra ID token for the user-assigned managed identity
      ▼
npx @vscode/vsce@3.9.2 publish --azure-credential
      │  vsce reads the token through its credential chain
      ▼
VS Code Marketplace authorizes the managed identity
      │  (publisher member, Contributor role)
      ▼
extension published
```

- The service connection is the Azure DevOps-side trust: it holds no secret.
  At run time Azure DevOps mints an OIDC token, Azure validates it against the
  federated credential on the managed identity, and `AzureCLI@2` turns it into
  an Entra ID token that vsce consumes.
- The identity must be a **user-assigned managed identity**. An App
  Registration / service principal authenticates but the Marketplace rejects
  the publish with `InvalidAccessException: The requested operation is not
  allowed`.
- No repository secrets or pipeline variables are needed; the service
  connection carries the authorization.

## One-time setup (required before the first publish)

A publisher owner of `manish-sharma-getanchorio` must do the following. Steps
1–6 are done by the person who runs the Azure / Azure DevOps accounts.

1. **Create an Azure DevOps organization and project** (if none exists) at
   <https://dev.azure.com>.
2. **Create the ARM service connection** (Project Settings → Service
   Connections → New service connection → Azure Resource Manager → **Workload
   Identity Federation (manual)**). Save it in draft mode — the verification
   values come from the managed identity created next.
3. **Create a user-assigned managed identity** in Azure (portal → Managed
   Identities → + Create). Any subscription and region work; assign the
   **Reader** role. Record the **Client ID**, **Tenant ID**, **Subscription**.
4. **Add a federated credential** to the managed identity (Settings →
   Federated credentials → + Add credential → *Azure AD workload identity* or
   *Azure DevOps*). Exchange values between Azure DevOps and Azure:
   - From Azure DevOps → Azure: the service connection's **issuer** and
     **subject** values
   - From Azure → Azure DevOps: the managed identity's **client ID, tenant ID,
     subscription**
   - Then in Azure DevOps select **Verify and save** on the service connection.
5. **Grant pipeline access** — open the service connection and grant access to
   the pipelines responsible for publishing.
6. **Register the identity with Azure DevOps and capture its profile ID**
   (one-time). The Marketplace publisher page recognizes neither the managed
   identity's ARM resource ID nor its Entra object ID. Run this once while
   authenticated **as the managed identity**:

   ```
   az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798
   ```

   From the returned JSON, capture the `id` field (the Azure DevOps profile ID).
   The GUID `499b84ac-1321-427f-aa17-267ca6975798` is Azure DevOps' well-known
   Entra app ID and is the same for every identity.
7. **Authorize the identity in the Marketplace** — on the publisher management
   page for `manish-sharma-getanchorio`, add a member using the profile ID from
   step 6 and assign the **Contributor** role. If the search does not find the
   identity, the `id` from step 6 is the only value the UI recognizes.

Until these are done, the publish stage fails. Once configured, publishing is
fully automated.

## Publishing a release

1. Bump the version in `package.json` (SemVer).
2. Update `CHANGELOG.md` (Keep a Changelog format).
3. Commit and push to `main` (Build stage runs on every push).
4. Create a tag matching the package version, e.g. `v0.1.1`, and push it.
5. The pipeline's Build stage runs lint, unit tests, integration tests,
   verifies the tag matches `package.json`, packages the VSIX, and uploads it
   as an artifact. For tag builds only, the Publish stage downloads the
   artifact, logs in to Azure via the service connection, and publishes with
   `vsce publish --azure-credential`.

The Build stage refuses to continue when the tag does not match the
`package.json` version, and `vsce` refuses to republish a version that already
exists on the Marketplace.

## Requirements and notes

- `--azure-credential` has been in `vsce` since v2.26.1; the pipeline pins the
  current stable `@vscode/vsce@3.9.2` for deterministic builds.
- Requires Node.js 26.4.0 (also satisfies vsce's Node >= 22 requirement).
- This branch keeps `main`'s GitHub Actions `publish.yml` (the OIDC trusted
  publishing flow) untouched for reference; the Entra DevOps flow lives in
  `azure-pipelines.yml`.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `InvalidAccessException: The requested operation is not allowed` | An App Registration/service principal was used. Only a user-assigned managed identity works. |
| Publish fails with `AADSTS...` or "no credentials found" | The service connection did not mint a token. Check the federated credential issuer/subject match the service connection, and that pipeline access is granted. |
| Publisher member "not found" when adding the identity | You entered the managed identity's Client ID / object ID / ARM resource ID. Only the Azure DevOps profile `id` from the `az rest profiles/me` call is accepted. |
| Publish fails on `/_apis/gallery/token` | `--oidc` trusted publishing is being used; it is not available on the public Marketplace. Use `--azure-credential` (this flow). |
| `Version ... already exists` | The version was already published; bump `package.json` or unpublish the old one. |
| Publish stage skipped | The Publish stage only runs for tag builds (`refs/tags/v*`). Push a tag matching the package version. |
