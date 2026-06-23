# GitHub Actions Usage

Rootmark can run in GitHub Actions in two ways: by calling the published npm
package directly (the CLI examples below), or through the repository's
composite [GitHub Action wrapper](#github-action-wrapper).

Neither approach is published to the GitHub Marketplace yet. Marketplace
publication requires a separate, manual release/tag step that this repository
does not perform automatically.

## Minimal workflow

```yaml
name: Rootmark

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run rootmark
        run: npx rootmark verify .
```

## JSON output

Use JSON output when another CI step or log parser needs structured results.

```yaml
name: Rootmark JSON

on:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run rootmark with JSON output
        run: npx rootmark verify . --format json
```

## SARIF output

Use SARIF output to upload findings to GitHub Code Scanning.

```yaml
name: Rootmark SARIF

on:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run rootmark with SARIF output
        run: npx rootmark verify . --format sarif > results.sarif

      - name: Upload SARIF to GitHub
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

## Controlling failures

Use `--fail-on` to decide which severity should fail the CI job.

```yaml
- name: Fail on errors only
  run: npx rootmark verify . --fail-on error
```

```yaml
- name: Report only
  run: npx rootmark verify . --fail-on off
```

Supported values:

- `warning`: fail on warnings and errors
- `error`: fail only on errors
- `off`: never fail based on findings

## GitHub Action wrapper

This repository also ships a **composite GitHub Action** (`action.yml`) that
runs the published `rootmark` npm CLI inside a workflow and can optionally
post a sticky PR summary comment. Internally the wrapper installs the
published package into an isolated temporary directory and runs that CLI; it
does not rely on `npx` for the scan, so package-manager output cannot
contaminate the JSON results.

> **Scope of this support**
>
> - Adding `action.yml` makes the repository *consumable* as an Action once it
>   is released and tagged. It does **not** publish the action to the GitHub
>   Marketplace — that is a separate, manual release step that this
>   repository does not perform automatically.
> - The PR comment is a **top-level conversation summary comment**, not an
>   inline review comment. Findings are currently file-level and do not carry
>   line numbers, so there is no safe anchor for inline review threads.

### Inputs

| Input | Default | Description |
|:------|:--------|:------------|
| `root` | `.` | Root path to scan for instruction files. |
| `fail-on` | `off` | Severity threshold that fails the job: `error`, `warning`, or `off`. Defaults to `off` so the Action never fails a job unless explicitly opted in. |
| `comment` | `false` | Post or update a sticky top-level PR summary comment (pull_request events only). |
| `github-token` | `${{ github.token }}` | Token used to post the PR comment. |
| `node-version` | `22` | Node.js version used to run the CLI. |

### Outputs

| Output | Description |
|:-------|:------------|
| `findings-count` | Total number of findings. |
| `json-path` | Absolute path to the JSON results file written during the scan. |

### Versioning and reproducibility

Internally the wrapper installs the published `rootmark` npm package into an
isolated temporary directory and then runs that installed CLI. Install
output is deliberately kept separate from the scanner's JSON output, so
package-manager logs can never be prepended to the results file. The
unpinned install resolves to the latest published version at runtime.

- An unpinned install (equivalent to `rootmark@latest`) is convenient but
  **mutable** — a new release can change results between runs.
- Pinning a version such as `rootmark@0.1.4` is **more reproducible**.

Likewise, pin the action itself to a tag (for example
`northgardtracker/rootmark@v0.1.4`) rather than a moving branch for
reproducible CI.

### Example: basic usage

```yaml
name: rootmark

on:
  pull_request:
    paths:
      - 'AGENTS.md'
      - 'CLAUDE.md'
      - 'GEMINI.md'
      - '.github/copilot-instructions.md'
      - '**/AGENTS.md'
      - '**/CLAUDE.md'
      - '**/GEMINI.md'

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: northgardtracker/rootmark@v0.1.4
        with:
          root: .
          fail-on: error
```

### Example: PR summary comment

Comment mode posts (and then updates in place) a single top-level PR comment.
It requires `pull-requests: write` so the token can create and update
comments:

```yaml
name: rootmark

on:
  pull_request:
    paths:
      - 'AGENTS.md'
      - 'CLAUDE.md'
      - 'GEMINI.md'
      - '.github/copilot-instructions.md'
      - '**/AGENTS.md'
      - '**/CLAUDE.md'
      - '**/GEMINI.md'

permissions:
  contents: read
  pull-requests: write

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: northgardtracker/rootmark@v0.1.4
        with:
          root: .
          fail-on: warning
          comment: true
```

If `comment: true` runs on an event other than `pull_request`, the comment
step is skipped with a notice; the scan and threshold steps still run.

### Example: warning threshold

```yaml
      - uses: northgardtracker/rootmark@v0.1.4
        with:
          fail-on: warning
```

### Example: report-only mode

Never fail the job — just surface the findings count, the JSON results
file, and (optionally) a comment:

```yaml
      - uses: northgardtracker/rootmark@v0.1.4
        with:
          fail-on: off
          comment: true
```

### How failure is decided

The action first collects findings with `--fail-on off`, so it can compute
outputs and post the comment *before* deciding the job result. It then
enforces your `fail-on` value from the JSON findings:

- `error`: fail only on `error`-severity findings.
- `warning`: fail on `warning`- or `error`-severity findings.
- `off`: never fail based on findings.
- Any other value fails the step with a clear configuration error.

Because the failure decision is made from the JSON (not the CLI exit code),
the PR comment is always posted before the job is allowed to fail.

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
- GitHub Code Scanning upload is handled by GitHub's
  `github/codeql-action/upload-sarif` action.
- A repo-local composite Action wrapper is available via `action.yml`; see
  [GitHub Action wrapper](#github-action-wrapper). It is not yet published
  to the GitHub Marketplace.
- The Action can post a top-level PR summary comment. Inline review comments
  are not implemented, because findings are file-level and do not include
  line numbers.
