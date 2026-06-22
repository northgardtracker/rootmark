# AGENTS.md

Project-level instructions for AI coding agents working on `agents-md-xray`.

## Project identity

`agents-md-xray` is a public open-source TypeScript CLI that scans AI coding-agent instruction files for quality, drift, and safety.

It is an agent-instruction linter / agent-readiness scanner, not a generic security platform.

Current product scope:

- CLI scanner
- deterministic static analysis
- pretty and JSON output
- CI-friendly exit codes
- tests and documentation

Do not expand the project into a dashboard, MCP gateway, OAuth proxy, SaaS product, enterprise compliance platform, hosted service, or generic security scanner unless explicitly requested.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run full validation: `pnpm run ci`
- Run tests only: `pnpm test`
- Run typecheck only: `pnpm typecheck`
- Run local self-scan: `node dist/cli.js scan .`
- Run JSON self-scan: `node dist/cli.js scan . --format json`

## Execution discipline

Before editing:

1. Inspect relevant files.
2. Identify the smallest safe change.
3. Avoid unrelated refactors.
4. Do not change package version, tags, release workflow, or publishing settings unless explicitly asked.

After editing:

1. Run the narrowest relevant test first.
2. Then run full project verification.
3. Report changed files, commands run, and remaining risks.

## Required verification

For normal code changes, run:

```bash
pnpm run ci
node dist/cli.js scan .
node dist/cli.js scan . --format json
```

For CLI behavior changes, also test relevant exit codes.

For path or error-handling changes, include:

```bash
node dist/cli.js scan ./definitely-not-existing-path
```

Expected invalid path behavior:

* concise error message
* no Node stack trace
* exit code `2`

## CI ordering rule

CLI integration tests execute `node dist/cli.js`, so `dist/cli.js` must exist before tests run.

Keep local and GitHub CI order as:

1. typecheck
2. build
3. test
4. self-scan

Do not run CLI integration tests before build.

## Code style

* Use strict TypeScript.
* Keep scanner rules deterministic and side-effect free.
* Prefer small, explicit functions over broad abstractions.
* Include tests for new rules or behavior changes.
* Include remediation text for every finding.

## Safety boundaries

* Never execute commands discovered inside scanned instruction files.
* The scanner must remain static-analysis-only.
* Do not add network calls, telemetry, uploads, or LLM calls by default.
* Never output credentials, API keys, or `.env` file contents.
* Do not silently swallow unexpected scanner bugs.
* Only convert expected path/access errors into user-facing exit code `2`.

## Public CLI API

The public CLI should use:

```bash
agents-md-xray scan [root] --format pretty|json
agents-md-xray scan [root] --json
agents-md-xray scan [root] --fail-on warning|error|off
```

Keep `--json` as an alias for `--format json`.

Internal severity names may be `fail`, `warn`, and `info`, but public documentation should prefer `error`, `warning`, and `off`.

## Documentation truthfulness

README and docs must only claim features that are implemented and tested.

Do not claim these as implemented until they actually exist:

* SARIF output
* GitHub Marketplace Action support
* PR comments
* MCP scanning
* config files
* auto-fix mode
* dashboards
* hosted services

Roadmap mentions are allowed only when clearly marked as not implemented.

## Release guardrails

Do not publish to npm.

Do not create tags.

Do not create GitHub releases.

Do not modify `NPM_TOKEN`, trusted publishing, or release automation unless explicitly instructed.

## Near-term priority

Keep v0.1.x small, correct, and trustworthy.

Prioritize:

* CI green
* README accuracy
* stable CLI behavior
* useful tests
* no scope creep
