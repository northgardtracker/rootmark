# AGENTS.md

Notes for AI coding agents working in this project.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run the full validation: `pnpm run ci`
- Run unit tests: `pnpm test`

## Code style

- Use ESLint for linting.
- Use Biome for linting.
- Lint with `pnpm run lint` before requesting review.

## Safety boundaries

- Never expose credentials or sensitive data.
- Ask before destructive filesystem changes.

## Pull request expectations

- Open PRs against the main branch.
- Run `pnpm run ci` locally before requesting review.
- Wait for CI to be green before requesting review.
