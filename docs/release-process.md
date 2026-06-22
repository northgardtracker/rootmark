# Release process and publishing guardrails

This document is for maintainers. It explains how `agents-md-xray` releases are created, what the automation handles, and what must be done manually.

## Overview

Releases are automated through a GitHub Actions workflow (`.github/workflows/release.yml`). The workflow triggers when a git tag matching `v*` is pushed.

## What maintainers must do before a release

1. **Ensure `main` is green**
   ```bash
   pnpm run ci
   node dist/cli.js scan .
   node dist/cli.js scan . --format json
   ```

2. **Update `package.json` version**
   Bump the `version` field to the new semver value (e.g. `0.1.4`). This is the only version change for the release.

3. **Update `CHANGELOG.md`**
   Add a new section for the release version with accurate highlights and changes.

4. **Commit and merge the version bump**
   Open a normal PR with the version and changelog changes. Do not include `NPM_TOKEN`, workflow, or unrelated changes.

5. **Create and push a git tag**
   After the version bump PR is merged to `main`:
   ```bash
   git checkout main
   git pull --ff-only
   git tag v0.1.4
   git push origin v0.1.4
   ```

   Pushing the tag automatically triggers the release workflow.

## What the release workflow does automatically

The workflow (`.github/workflows/release.yml`) performs the following:

1. **Checkout, install, build, and test**
   - Runs `pnpm install --frozen-lockfile`
   - Runs `pnpm build`
   - Runs `pnpm test`

2. **Idempotent npm publish check**
   - Reads `package.json` name and version.
   - Runs `npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version`.
   - If the version already exists on npm, it **skips publishing**.
   - If the version does not exist, it publishes with:
     ```bash
     pnpm publish --access public --no-git-checks
     ```
   - This guardrail prevents accidental republishing of an already-published version.

3. **Create GitHub Release**
   - Uses `softprops/action-gh-release@v2`.
   - Generates release notes automatically.
   - **Note:** This step runs even if npm publish is skipped.

## Guardrails

- **Do not publish manually.** Use the workflow only.
- **Do not create tags without updating `package.json` and `CHANGELOG.md` first.**
- **Do not push tags from non-`main` branches** unless there is an explicit reason.
- **Do not modify `.github/workflows/release.yml`** or `NPM_TOKEN` without explicit maintainer approval.
- **Normal documentation and code PRs must not include version bumps, tags, or release metadata.**
- **Already-published npm versions cannot be overwritten.** The workflow skips publish if the version exists.

## Verify a release

After the workflow finishes, confirm the release is live:

```bash
npm view agents-md-xray version
npx agents-md-xray --version
```

Check the GitHub Releases page for the generated release notes.

## Current state

- Current package version: `0.1.3`
- Current npm version: `0.1.3`
- Release workflow is idempotent for npm publish.
