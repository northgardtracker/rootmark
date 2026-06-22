# Changelog

All notable public releases of `agents-md-xray`.

## v0.1.3

First published CLI-first release.

### Highlights

- Published `agents-md-xray` to npm.
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
