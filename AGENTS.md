# AGENTS.md

## Setup commands
- Install dependencies: `pnpm install`

## Test commands
- Run full validation: `pnpm run ci`
- Run tests only: `pnpm test`
- Run typecheck only: `pnpm typecheck`

## Code style
- Use strict TypeScript.
- Keep scanner rules deterministic and side-effect free.
- Do not add network calls to scanner rules without an explicit feature flag.

## Safety boundaries
- Never execute user-provided MCP commands during scanning.
- Never output credentials, API keys, or `.env` file contents.
- Prefer explainable findings over opaque model judgments.

## Pull request expectations
- Add tests for every new rule.
- Include remediation text for every finding.
- Keep changes small and reviewable.
