# Changelog

All notable public releases of `rootmark`.

## [Unreleased]

Rename project to Rootmark; reposition to grounded verification; begin
deprecating prose-quality/score and security-style framing.

### Removed

- 0–100 score retired; Rootmark reports findings, not a score. The `score`
  field is gone from `ScanResult`, the JSON output, the pretty CLI output,
  the GitHub Action PR comment, the action output, and the rule descriptor
  catalog.

### Changed

- Default `--fail-on` is now `off` (report-only). `rootmark verify .`
  no longer fails CI on findings unless `--fail-on warning` or
  `--fail-on error` is passed explicitly.
- GitHub Action `fail-on` input now defaults to `off` (report-only),
  matching the CLI default. The action no longer hardcodes `error`
  anywhere; an unset `FAIL_ON` environment variable is treated as `off`.
- Default scan now runs **grounding rules only** (stale-commands,
  contradictory-rules, nested-tool-conflicts, nested-missing-override,
  plus the always-on `instruction-file.missing` check). Prose-style and
  risky-instruction heuristics (required-sections, context-bloat,
  vague-instructions, dangerous-instructions) are opt-in via
  `--strict`. The CLI parses `--strict` and passes it to `scan()`;
  all rule code is preserved, only the gating changed.

### Fixed

- `rootmark verify --help` and `rootmark verify . --help` now print
  the usage block and exit `0` instead of running the scan.

## v0.1.4

### Added

- SARIF v2.1.0 output support via `--format sarif`.
- Severity mapping: `fail` → `error`, `warn` → `warning`, `info` → `note`.
- Rule descriptors and result locations mapped to SARIF spec.
- GitHub Actions usage docs updated with SARIF upload example.
- Stable full SARIF rule descriptor catalog emitted from a centralized rule
  metadata source, so clean scans still describe every known rule.

> Note: this release was published under the previous name
> `agents-md-xray`. The package metadata, CLI binary, and registry URL
> changed in the next release under the new name `rootmark`.

## v0.1.3

First published CLI-first release.

### Highlights

- Published the initial CLI-first package to npm.
- Added CLI support for `--format pretty|json`, `--json`, `--fail-on warning|error|off`, and `--version`.
- Improved release workflow safety by skipping npm publish when the package version already exists.
- Clarified project status and security model in public docs.

## v0.1.2

Historical 0.1.x stabilization release.

### Changes

- Bumped the package version from `0.1.1` to `0.1.2`.
- Fixed scanner handling for missing or empty directories used by test fixtures.
- Added an empty-directory fixture for scanner behavior validation.

## v0.1.1

Historical 0.1.x stabilization release.

### Changes

- Bumped the package version from `0.1.0` to `0.1.1`.

## v0.1.0

Initial public repository release.

### Highlights

- Added the initial CLI scanner.
- Added deterministic checks for agent instruction files.
- Added tests, CI workflow, release workflow, and OSS project documentation.
