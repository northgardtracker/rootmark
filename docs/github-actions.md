# GitHub Actions Usage

`agents-md-xray` can run in GitHub Actions through the published npm package.

This is usage documentation for the CLI. It is not a GitHub Marketplace Action.

## Minimal workflow

```yaml
name: Agents MD X-Ray

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  scan-agent-instructions:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run agents-md-xray
        run: npx agents-md-xray scan .
```

## JSON output

Use JSON output when another CI step or log parser needs structured results.

```yaml
name: Agents MD X-Ray JSON

on:
  pull_request:

jobs:
  scan-agent-instructions:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run agents-md-xray with JSON output
        run: npx agents-md-xray scan . --format json
```

## SARIF output

Use SARIF output to upload findings to GitHub Code Scanning.

```yaml
name: Agents MD X-Ray SARIF

on:
  pull_request:

jobs:
  scan-agent-instructions:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run agents-md-xray with SARIF output
        run: npx agents-md-xray scan . --format sarif > results.sarif

      - name: Upload SARIF to GitHub
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

## Controlling failures

Use `--fail-on` to decide which severity should fail the CI job.

```yaml
- name: Fail on errors only
  run: npx agents-md-xray scan . --fail-on error
```

```yaml
- name: Report only
  run: npx agents-md-xray scan . --fail-on off
```

Supported values:

- `warning`: fail on warnings and errors
- `error`: fail only on errors
- `off`: never fail based on findings

## Expected exit codes

- `0`: scan completed and did not meet the configured failure threshold
- `1`: scan completed and findings met the configured failure threshold
- `2`: CLI usage or root path error

## Notes

- The scanner performs static analysis only.
- It does not execute commands found in scanned files.
- It does not collect telemetry.
- It does not upload scanned content by default.
- SARIF output is available via `--format sarif`.
- GitHub Code Scanning upload is handled by GitHub's `github/codeql-action/upload-sarif` action.
- GitHub Marketplace Action support is not implemented yet.
- PR comments are not implemented yet.
