# GEMINI.md

Notes for Gemini-style agents working in this repository.

## Setup

- Install workspace dependencies: `pnpm install`
- Use the pnpm version pinned in `package.json`.

## Checks

- Run the full validation suite: `pnpm run ci`
- Run tests: `pnpm test`
- Type-check only: `pnpm typecheck`

## Style

- Strict TypeScript across the codebase.
- Lint with `pnpm run lint` before review.
- Prefer small, focused functions over broad abstractions.

## Safety

- Never commit credentials.
- Do not edit generated artifacts in `dist/`.
- Ask before touching shared infrastructure config.

## Pull request flow

- Open a PR against `main`.
- Wait for CI green before requesting review.
- Squash-merge once approved.
