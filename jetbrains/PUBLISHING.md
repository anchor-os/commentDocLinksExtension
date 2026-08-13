# Publishing to the JetBrains Marketplace

Publishing is **manual** and **deliberately decoupled** from the VS Code / Open
VSX pipelines. The JetBrains workflow (`.github/workflows/jetbrains-publish.yml`)
is `workflow_dispatch`-only — it never fires automatically on a VS Code release.

## Prerequisites

1. A **JetBrains Marketplace vendor account** (getanchor.io).
2. The plugin **registered** so the id `com.anchor.commentdoclinks` belongs to
   your account (create it on the Marketplace; the first version is uploaded via
   the website or, once registered, via the API token).
3. A **Marketplace auth token** stored as the repo/environment secret
   `JETBRAINS_MARKETPLACE_TOKEN`.

## Signing

The plugin is signed via the **Marketplace signature API** using
`JETBRAINS_MARKETPLACE_TOKEN` — no separate code-signing certificate is required.
`build.gradle.kts` configures only `publishing { token = ... }`; `signPlugin`
requests the signature from the Marketplace automatically.

> If you instead prefer the legacy certificate-based signing, set
> `JETBRAINS_CERTIFICATE_CHAIN` / `JETBRAINS_PRIVATE_KEY` /
> `JETBRAINS_PRIVATE_KEY_PASSWORD` and add a `signing { }` block in
> `build.gradle.kts`. The token path is simpler and is what is configured today.

## Local build + sign (for a manual website upload)

```bash
cd jetbrains
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
export JETBRAINS_MARKETPLACE_TOKEN=PASTE_TOKEN_HERE
./gradlew signPlugin      # builds (if needed) and signs the distribution in place
```

Artifact: `build/distributions/comment-doc-links-jetbrains-0.1.3.zip`
(then upload it via the Marketplace website for the **first** publication, or use
the token for subsequent versions).

## First-time publication

The very first version must be registered on the Marketplace website (the plugin
id must exist before any token upload succeeds). After that, new versions can be
pushed via the token. The first upload also goes through JetBrains manual review
before it becomes public.

## CI publish (subsequent versions)

Trigger **Publish JetBrains Plugin** from the Actions tab:

- Input `release_ref` — a `vX.Y.Z` tag, e.g. `v0.1.3`.
- The workflow validates the tag shape and that the tag exists on `origin`
  (`git ls-remote`), then checks out the fully-qualified `refs/tags/<release_ref>`
  so a same-named branch cannot shadow the release.
- It runs `./gradlew buildPlugin publishPlugin` (which also signs via the token).

Steps:

```bash
git tag v0.1.3
git push origin v0.1.3
# Then: Actions → Publish JetBrains Plugin → Run workflow → release_ref = v0.1.3
```

### Secrets / environment

- `JETBRAINS_MARKETPLACE_TOKEN` — required (Marketplace auth token).
- `JETBRAINS_MARKETPLACE_CHANNELS` — optional; defaults to the `default` channel.
  Comma-separated for multiple channels.
- If your secrets live in a protected GitHub **environment** (e.g.
  `marketplace-publish`, as the Open VSX workflow uses), add
  `environment: marketplace-publish` to the publish job so the secrets resolve.

## Versioning

`version` in `build.gradle.kts` must match the release tag (drop the leading `v`):
tag `v0.1.3` ⇒ `version = "0.1.3"`. Bump both together.
