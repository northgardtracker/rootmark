# AGENTS.md

Notes for AI coding agents working in the packages directory.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run unit tests with Vitest.
- Run the full validation: `pnpm run ci`

## Code style

- Use ESLint for linting.
- Lint with `pnpm run lint` before requesting review.

## Safety boundaries

- Never expose credentials or sensitive data.
- Ask before destructive filesystem changes.

## Pull request expectations

- Open PRs against the main branch.
- Run `pnpm run ci` before requesting review.
