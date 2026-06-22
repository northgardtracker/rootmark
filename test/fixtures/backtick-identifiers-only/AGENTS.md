# AGENTS.md

Notes for AI coding agents working in this project.

## Setup commands

Make sure to install all required dependencies before starting work.
The `package.json` file lists the pinned versions.
The lockfile should be committed alongside `package.json`.

## Test commands

Run the projects test suite before submitting your changes.
Tests live under the `test/` directory.

## Code style

Write clean code and prefer small, focused functions.
See `src/` for the scanner implementation.
Refer to `README.md` for project conventions.

## Safety boundaries

Never expose credentials or sensitive data.
Do not edit generated files under `dist/`.

## Pull request expectations

Open PRs against the `main` branch and reference any relevant issues.
Reference `UserService` for naming conventions if you touch that module.
