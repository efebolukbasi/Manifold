# Releasing Manifold

## Desktop installer via GitHub Releases

This repo now includes a GitHub Actions release workflow at `.github/workflows/release.yml`.

To create a Windows release:

1. Bump the version in `package.json`, `packages/desktop/package.json`, and `packages/desktop/src-tauri/tauri.conf.json`.
   For the current Windows desktop beta track, use a numeric prerelease version such as `0.1.0-5`.
2. Commit and push the version change.
3. Create and push a matching Git tag such as `v0.1.0-5`.
4. GitHub Actions will build the Tauri desktop app on Windows and create a draft pre-release with the installer artifacts attached.
5. Review the draft release and publish it.

## Current public-distribution caveats

The desktop build is packaged as a Tauri installer, but it is not a fully standalone native app yet.

- The app launches a bundled JavaScript bridge with `node`, so end users currently need Node.js 20+ installed.
- If users want Claude Code, Gemini CLI, or Codex integration, those CLIs still need to be installed separately.
- The release is unsigned. Windows SmartScreen warnings are expected until code signing is added.
- MSI packaging rejects labels like `beta.4` in the app version, so keep the app version prerelease identifier numeric-only.

## What the release workflow bundles

- Frontend assets from `packages/desktop/dist`
- The compiled bridge entrypoint at `packages/desktop/bridge/dist/server.js`
- Standard Tauri Windows bundle targets

## npm publishing

The desktop installer path is now automated through GitHub Releases.

Publishing the CLI to npm is a separate release track. That should be handled after you decide whether you want:

- a public `@manifold/cli` package with the workspace packages published alongside it, or
- a more self-contained CLI build that bundles more of the internal workspace code
