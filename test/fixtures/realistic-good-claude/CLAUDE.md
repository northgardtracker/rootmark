# CLAUDE.md

Guidance for Claude-style coding agents working in this repository.

## Getting started

- Install dependencies: `pnpm install`
- Use the pnpm version pinned in `package.json`.

## Validation

- Full project check: `pnpm run ci`
- Unit tests: `pnpm test`
- Type-check only: `pnpm typecheck`

## Conventions

- Strict TypeScript everywhere.
- Lint with `pnpm run lint` before review.
- Prefer named exports and small, focused functions.

## Do not

- Never edit generated files under `dist/`.
- Do not commit secrets or `.env` content.
- Ask before destructive operations on shared resources.

## Review

- All changes go through pull requests against `main`.
- Wait for CI to be green before requesting review.
- Address review comments before merging.
