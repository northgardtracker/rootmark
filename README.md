# Rootmark — Grounded verification for AGENTS.md and AI-agent instructions.

Rootmark verifies that the Node/npm/pnpm commands written in `AGENTS.md`-style
instruction files match the repository's actual package metadata — without
executing anything.

---

## v0.1 status

v0.1 is being refactored toward grounded verification; some legacy checks are
being deprecated. The current CLI still runs the older checks while the new
grounding model is being introduced. Expect output shape to evolve within
the v0.1.x line.

---

## What it does

- Discovers `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and
  `.github/copilot-instructions.md` files.
- Extracts `npm`, `pnpm`, and `yarn` commands from fenced code blocks.
- Grounds each command against the repository's package metadata
  (`package.json` scripts, `packageManager`, lockfiles, pnpm workspaces).
- Reports each command reference as one of three states:

  | State             | Meaning                                                                       |
  | :---------------- | :---------------------------------------------------------------------------- |
  | `verified`        | The command is defined in `package.json` scripts.                             |
  | `missing`         | The command references a script that is not defined in `package.json`.        |
  | `cannot_verify`   | No `package.json` is available at the scan root, so the command cannot be grounded. |

- Reports findings through the CLI (pretty, JSON, SARIF) without ever executing
  the commands it inspects.
- Runs **grounding rules by default**: stale-commands, contradictory-rules,
  and nested-tool conflicts. These check whether what the instructions say
  matches what the repository actually defines.
- Opts into prose-style and risky-instruction heuristics only with
  `--strict`: required-sections, context-bloat, vague-instructions,
  and dangerous-instructions. Default scans never grade writing quality.

## What it does NOT do (v0.1)

- **Does not execute commands.** Rootmark only reads files and package
  metadata. It never runs anything found in the scanned instruction files.
- **Does not mine prose.** It does not grade writing style, tone, or clarity.
- **Does not scan for CVE-class issues.** It is not a CVE scanner, dependency
  auditor, or SAST tool.
- **Does not guarantee agent safety.** Grounded verification reduces drift
  between instructions and reality; it is not a safety certification.
- **Is not an official `AGENTS.md` validator.** There is no canonical
  authority on `AGENTS.md`; Rootmark checks internal consistency, not
  conformance to an external spec.
- **Defaults to report-only.** A clean scan does not fail CI by default.
  Use `--fail-on` to opt into stricter exit behavior.

---

## Quick Start

> **v0.1 under construction.** The CLI works today, but the output shape and
> rule set are being refactored.

```bash
npx rootmark verify .
```

That's it. Rootmark auto-discovers instruction files at the current directory.

---

## Installation

```bash
# npm
npm install -g rootmark

# pnpm
pnpm add -g rootmark

# Or use directly — no install needed
npx rootmark verify .
```

---

## CLI reference

```
rootmark verify [root] [options]

Options:
  --format <pretty|json|sarif>   Output format (default: pretty)
  --json                         Alias for --format json
  --fail-on <warning|error|off>  Exit 1 when findings match this level (default: off)
  --help, -h                     Show this help
  --version                      Show version
```

Examples:

```bash
rootmark verify .
rootmark verify . --format json
rootmark verify . --json
rootmark verify . --format sarif
rootmark verify . --fail-on warning
rootmark verify . --fail-on off
rootmark verify ./packages/my-lib
```

---

## Example output

### Current v0.1 output (pretty)

```
Rootmark — 1 finding(s) (1 error, 0 warning, 0 info)
instruction files: AGENTS.md

[FAIL] stale-command.missing-package-script (AGENTS.md)
  Referenced npm script does not exist: Instruction references script "deploy", but package.json does not define it.
  Evidence: pnpm deploy
  Fix: Add "deploy" to package.json scripts, or update the agent instruction.
```

### Grounded verification (direction for v0.1.x)

The three-state grounding model is being introduced in the v0.1.x line.
The current CLI still emits the legacy pretty output above; the grounded
output below is illustrative:

```
Rootmark

Instruction files: AGENTS.md

Grounded commands:
  ✓ pnpm install       verified
  ✓ pnpm run lint      verified
  ✗ pnpm deploy        missing       (script not defined in package.json)
  ? pnpm run e2e       cannot_verify (no package.json at scan root)

Findings:
  [FAIL] stale-command.missing-package-script (AGENTS.md)
    Referenced script "deploy" is not defined in package.json.
    Evidence: pnpm deploy
    Fix: Add "deploy" to package.json scripts, or update the agent instruction.
```

---

## CI Integration

### GitHub Actions (CLI)

```yaml
name: Rootmark

on:
  pull_request:
    paths:
      - 'AGENTS.md'
      - 'CLAUDE.md'
      - 'GEMINI.md'
      - '.github/copilot-instructions.md'

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx rootmark verify . --fail-on warning
```

The repository also ships a composite GitHub Action (`action.yml`) that runs
the published CLI and can optionally post a sticky PR summary comment. See
[docs/github-actions.md](docs/github-actions.md) for details.

---

## Design principles

1. **Static analysis only.** Rootmark reads files and package metadata. It
   never executes commands found in scanned instruction files.
2. **Deterministic.** Rule-based checks; no LLM analysis, no randomness.
3. **Local-first.** No telemetry, no upload by default.
4. **CI-friendly.** Stable exit codes and machine-readable output.
5. **Maintainer-oriented.** Every finding includes an actionable remediation.

---

## Documentation

- [Why AGENTS.md matters](docs/why-agents-md-matters.md)
- [GitHub Actions usage](docs/github-actions.md)
- [Release process](docs/release-process.md)
- [Examples gallery](docs/examples/README.md)
- [Roadmap](ROADMAP.md)
- [Decisions log](docs/decisions.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Scope discipline matters: v0.1 is
grounded verification only. PRs that expand scope beyond that will be
rejected.

---

## License

MIT © [Rootmark contributors](https://github.com/northgardtracker/rootmark/graphs/contributors)

---

<p align="center">
  <sub>If you find Rootmark useful, please consider giving it a ⭐ on GitHub!</sub>
</p>
