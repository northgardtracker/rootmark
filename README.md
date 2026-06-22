<p align="center">
  <br />
  <code>&nbsp;┌─────────────────────────────────────────┐&nbsp;</code><br />
  <code>&nbsp;│&nbsp;&nbsp;agents-md-xray&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;</code><br />
  <code>&nbsp;│&nbsp;&nbsp;X-ray for AGENTS.md and instruction&nbsp;&nbsp;&nbsp;│&nbsp;</code><br />
  <code>&nbsp;│&nbsp;&nbsp;drift in AI coding agent repos&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;</code><br />
  <code>&nbsp;└─────────────────────────────────────────┘&nbsp;</code><br />
  <br />
  <a href="https://www.npmjs.com/package/agents-md-xray"><img src="https://img.shields.io/npm/v/agents-md-xray?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://github.com/northgardtracker/agents-md-xray/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/northgardtracker/agents-md-xray/ci.yml?branch=main&style=flat-square&label=CI" alt="CI" /></a>
  <a href="https://github.com/northgardtracker/agents-md-xray/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://github.com/northgardtracker/agents-md-xray/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

---

## Why this exists

AI coding agents — Codex, Claude Code, Cursor, GitHub Copilot, Gemini CLI — read instruction files before editing code. When those files are **missing**, **stale**, **bloated**, or **unsafe**, agents waste tokens, skip validation, or make overly broad changes.

`agents-md-xray` turns agent instructions into a **reviewable, testable artifact** — just like you lint your code, now you can lint your agent instructions.

## Quick Start

```bash
npx agents-md-xray scan .
```

That's it. It auto-discovers `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md`.

## Project Status

`agents-md-xray` is an early v0.1.x, CLI-first release.

- The scanner is static-analysis-only.
- It reads local files and package metadata, then reports findings.
- It never executes commands found in scanned files.
- It does not send telemetry.
- It does not upload data over the network by default.
- `npm` and `npx` usage is valid because the package is already published.

Roadmap items listed below are not yet implemented unless explicitly checked off.

## Features

- 🔍 **Auto-discovery** — Finds all agent instruction files recursively
- ⚠️ **Dangerous instruction detection** — Catches prompt injection, test skipping, secret exposure
- 📏 **Context bloat analysis** — Warns when instructions are too long for efficient agent use
- 🔗 **Stale command detection** — Verifies `pnpm test`, `pnpm run lint`, etc. match `package.json`
- 📋 **Required section checks** — Ensures setup, test, style, safety, and PR sections exist
- 📊 **Output formats** — Pretty (human-readable) and JSON for automation
- 🎯 **Configurable fail threshold** — Fail CI on `error`, `warning`, or disable with `off`

## Installation

```bash
# npm
npm install -g agents-md-xray

# pnpm
pnpm add -g agents-md-xray

# Or use directly — no install needed
npx agents-md-xray scan .
```

## Usage

### Scan a repository

```bash
# Default scan with pretty output
agents-md-xray scan .

# JSON output for automation
agents-md-xray scan . --format json
agents-md-xray scan . --json          # shorthand

# Fail CI on any warning or worse
agents-md-xray scan . --fail-on warning

# Never fail (just report)
agents-md-xray scan . --fail-on off

# Scan a specific directory
agents-md-xray scan ./packages/my-lib
```

### CLI Reference

```
agents-md-xray scan [root] [options]

Options:
  --format <pretty|json>         Output format (default: pretty)
  --json                         Alias for --format json
  --fail-on <warning|error|off>  Exit 1 when findings match this level (default: error)
  --help, -h                     Show help
  --version                      Show version
```

### Example Output

```
agents-md-xray score: 64/100
instruction files: AGENTS.md

[FAIL] dangerous-instruction.system-override (AGENTS.md)
  Potentially dangerous instruction: Instruction override language can behave like prompt injection.
  Evidence: ignore previous instructions
  Fix: Replace with a scoped, auditable rule that says when the agent should ask for approval.

[FAIL] stale-command.missing-package-script (AGENTS.md)
  Referenced npm script does not exist: Instruction references script "deploy", but package.json does not define it.
  Evidence: pnpm deploy
  Fix: Add "deploy" to package.json scripts, or update the agent instruction.

[WARN] context-bloat.too-long (AGENTS.md)
  Instruction file may be too large: This file has about 1200 words.
  Fix: Move long reference material into docs/ and keep AGENTS.md focused on commands, boundaries, and invariants.
```

## Security Model

- Scans local files only.
- Uses deterministic, rule-based checks.
- Never executes commands found in scanned instruction files.
- Does not collect telemetry.
- Does not make network calls or uploads by default.
- Security reports should follow [SECURITY.md](SECURITY.md).

### Examples

- [Good minimal example](docs/examples/good-minimal.md)
- [Dangerous example](docs/examples/bad-dangerous.md)

## Documentation

- [SARIF output design](docs/design/sarif-output.md)
- [GitHub Actions usage](docs/github-actions.md)
- [Examples](docs/examples/README.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)

## Checks

| ID | Severity | What it checks |
|:---|:---------|:---------------|
| `instruction-file.missing` | 🔴 error | No AGENTS.md / CLAUDE.md / GEMINI.md found |
| `required-section.setup` | 🔴 error | Missing setup/install commands section |
| `required-section.test` | 🔴 error | Missing test/validation commands section |
| `required-section.style` | 🟡 warning | Missing code style conventions section |
| `required-section.safety` | 🟡 warning | Missing safety boundaries section |
| `required-section.pr` | 🟡 warning | Missing PR/review expectations section |
| `dangerous-instruction.system-override` | 🔴 error | Prompt injection pattern ("ignore previous instructions") |
| `dangerous-instruction.skip-tests` | 🔴 error | Blanket test-skipping instruction |
| `dangerous-instruction.reckless-write` | 🔴 error | Overly broad write permission |
| `dangerous-instruction.secret-exposure` | 🔴 error | Instruction to print secrets or env vars |
| `context-bloat.too-long` | 🟡/🔴 | File exceeds 900 words (warning) or 1600 words (error) |
| `stale-command.missing-package-script` | 🔴 error | Referenced npm script doesn't exist in package.json |

> **Note on severity labels:** Internally the scanner uses `fail`, `warn`, and `info`. The CLI maps `error` → `fail` and `warning` → `warn`. Both forms are accepted by `--fail-on`.

## CI Integration

### GitHub Actions

```yaml
name: Lint Agent Instructions
on:
  pull_request:
    paths:
      - 'AGENTS.md'
      - 'CLAUDE.md'
      - 'GEMINI.md'
      - '.github/copilot-instructions.md'

jobs:
  xray:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx agents-md-xray scan . --fail-on warning
```

## Design Principles

1. **Deterministic first** — Rule-based checks before LLM analysis
2. **Local-first** — No telemetry, no upload by default
3. **Safe by default** — Never execute untrusted configs while scanning
4. **CI-friendly** — Stable exit codes and machine-readable output
5. **Maintainer-oriented** — Findings include actionable remediation

## Roadmap

- [x] CLI scanner with pretty/JSON output
- [x] Required section detection
- [x] Dangerous instruction detection
- [x] Context bloat analysis
- [x] Stale command detection (run + direct shorthand)
- [ ] SARIF output for GitHub Code Scanning ([#1](https://github.com/northgardtracker/agents-md-xray/issues/1))
- [ ] GitHub Action with PR comments ([#2](https://github.com/northgardtracker/agents-md-xray/issues/2))
- [ ] Nested AGENTS.md conflict detection ([#3](https://github.com/northgardtracker/agents-md-xray/issues/3))
- [ ] MCP config inventory and risk preview ([#4](https://github.com/northgardtracker/agents-md-xray/issues/4))
- [ ] Auto-fix mode for safe, mechanical improvements ([#5](https://github.com/northgardtracker/agents-md-xray/issues/5))

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [agents-md-xray contributors](https://github.com/northgardtracker/agents-md-xray/graphs/contributors)

---

<p align="center">
  <sub>If you find agents-md-xray useful, please consider giving it a ⭐ on GitHub!</sub>
  <br />
  <sub>Built for the agentic coding era 🤖</sub>
</p>
