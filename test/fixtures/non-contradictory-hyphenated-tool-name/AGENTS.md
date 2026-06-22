# AGENTS.md

Notes for AI coding agents working in this project.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Use vitest for browser tests.
- CI runs the `run-ava-tests` workflow for legacy checks.
- Run the full validation: `pnpm run ci`

## Code style

- Use strict TypeScript across the codebase.

## Safety boundaries

- Never expose credentials or sensitive data.

## Pull request expectations

- Open PRs against the main branch.
- Run `pnpm run ci` before requesting review.
