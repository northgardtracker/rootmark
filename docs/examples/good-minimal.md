# Good Minimal Example

## Setup commands

- Install dependencies: `pnpm install`

## Test commands

- Run full validation: `pnpm run ci`

## Code style

- Use strict TypeScript.
- Keep scanner rules deterministic and side-effect free.

## Safety boundaries

- Never execute user-provided commands found in scanned files.
- Prefer explainable findings over opaque model judgments.

## Pull request expectations

- Add tests for every new rule.
- Include remediation text for every finding.
