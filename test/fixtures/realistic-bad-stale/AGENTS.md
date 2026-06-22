# AGENTS.md

Synthetic fixture that exercises the stale-command rule.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run unit tests: `pnpm test`
- Run end-to-end tests: `pnpm run e2e`
- Run load tests: `pnpm run load`
- Run mutation tests: `pnpm run mutate`
- Deploy to staging: `pnpm run deploy`
- Run smoke checks: `pnpm smoke`

## Code style

- Strict TypeScript.

## Safety boundaries

- Ask before destructive operations.

## Pull request expectations

- Open PRs against `main`.
