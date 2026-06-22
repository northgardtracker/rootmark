# Contributing to agents-md-xray

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/northgardtracker/agents-md-xray.git
cd agents-md-xray

# Install dependencies
pnpm install

# Run the full validation pipeline
pnpm run ci
```

## Available Scripts

| Script | Description |
|:-------|:------------|
| `pnpm dev` | Run CLI in development mode via tsx |
| `pnpm build` | Compile TypeScript to dist/ |
| `pnpm test` | Run tests with Vitest |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm lint` | Run ESLint |
| `pnpm run ci` | Run typecheck + test + build |

## Adding a New Rule

1. Create `src/rules/your-rule.ts` exporting a function matching `(file: string, text: string) => Finding[]`
2. Import and call it in `src/scanner.ts`
3. Add tests in `test/scanner.test.ts` with a fixture if needed
4. Include remediation text in every finding

## Code Style

- **TypeScript strict mode** — no `any`, no implicit returns
- **ESM only** — use `.js` extensions in imports
- **Deterministic rules** — no network calls, no randomness in rules
- **Side-effect free** — rules must not modify the filesystem

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new rule for duplicate sections
fix: handle Windows paths in stale-commands
docs: improve README quick start section
test: add edge case for empty AGENTS.md
```

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Run `pnpm run ci` to verify everything passes
4. Open a PR with a clear description
5. Respond to review feedback

## Reporting Issues

- Use the [bug report template](https://github.com/northgardtracker/agents-md-xray/issues/new?template=bug_report.md) for bugs
- Use the [feature request template](https://github.com/northgardtracker/agents-md-xray/issues/new?template=feature_request.md) for new ideas

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
