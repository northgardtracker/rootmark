# AGENTS.md

Notes for AI coding agents working in this project.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run the full validation: `pnpm run ci`
- Run unit tests: `pnpm test`

## Code style

- Use ESLint for app source files.
- Use Biome only for generated files.

## Safety boundaries

- Never expose credentials or sensitive data.

## Pull request expectations

- Open PRs against the main branch.
- Run `pnpm run ci` before requesting review.
