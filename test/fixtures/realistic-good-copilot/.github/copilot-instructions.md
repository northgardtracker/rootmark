# GitHub Copilot Instructions

Guidance for GitHub Copilot in this repository.

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Full validation: `pnpm run ci`
- Unit tests: `pnpm test`
- Type-check: `pnpm typecheck`

## Code style

- Strict TypeScript.
- Lint with `pnpm run lint`.

## Safety boundaries

- Never commit secrets or `.env` content.
- Do not edit generated files in `dist/`.
- Ask before destructive changes.

## Pull request expectations

- Open PRs against `main`.
- Wait for CI to pass before requesting review.
- Address review comments before merging.
