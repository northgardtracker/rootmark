# AGENTS.md

Notes for AI coding agents working in this project.

## Setup commands

- Install dependencies with `npm install` or `pnpm install`.
- Use the package manager pinned in `package.json`.

## Test commands

- Run the full validation: `pnpm run ci`
- Run unit tests: `pnpm test`

## Code style

- Use strict TypeScript across the codebase.

## Safety boundaries

- Never expose credentials or sensitive data.

## Pull request expectations

- Open PRs against the main branch.
- Run `pnpm run ci` before requesting review.
