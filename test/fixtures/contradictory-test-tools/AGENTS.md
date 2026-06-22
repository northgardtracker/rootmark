# AGENTS.md

Notes for AI coding agents working in this project.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run Jest before opening a PR.
- Run Vitest before opening a PR.
- Run the full validation: `pnpm run ci`

## Code style

- Use strict TypeScript across the codebase.
- Lint with `pnpm run lint` before requesting review.

## Safety boundaries

- Never expose credentials or sensitive data.

## Pull request expectations

- Open PRs against the main branch.
- Run `pnpm run ci` before requesting review.
