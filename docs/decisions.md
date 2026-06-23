# Decisions log

This document records the design and product decisions that shape Rootmark.
Each entry explains the decision, the reasoning, and what was accepted or
rejected along the way.

## Why v0.1 is static grounding, not command execution or security scanning

**Decision:** Rootmark v0.1 is a static analyzer. It grounds commands
written in `AGENTS.md`-style instruction files against the repository's
actual package metadata. It does not execute those commands, and it does
not position itself as a security scanner.

**Reasoning:**

- **Execution = arbitrary code execution risk.** If Rootmark ran the
  commands it found, it would be an arbitrary code execution engine for
  whatever an instruction file happened to say. That is a non-starter for
  a tool whose own marketing is about safe agent instructions — a
  "trustworthy agent-instruction tool" that itself runs untrusted code is
  a contradiction.
- **Security claims = overclaim.** Calling Rootmark a "security scanner"
  invites users to trust it for things it cannot do. It does not detect
  CVEs, it does not audit dependencies, it does not do SAST, and it does
  not guarantee that an AI agent will behave safely after reading a
  grounded instruction file. Claiming otherwise would mislead users and
  create liability for the project.
- **Static grounding = trustworthy, deterministic, zero-false-positive
  goal.** Comparing the commands written in an instruction file against
  `package.json` scripts, `packageManager`, lockfiles, and pnpm
  workspaces is a closed-world, deterministic check. The answer is either
  *the script exists*, *the script does not exist*, or *we cannot tell
  because no `package.json` was found*. That maps cleanly to the
  three-state model (`verified`, `missing`, `cannot_verify`) and gives
  maintainers a maintainable signal without false confidence.

**What we accepted:**

- The tool is narrower than some users want. People will ask for "real"
  command execution, MCP scanning, CVE checks, etc. Those are real
  problems; they are also out of scope for v0.1 by design.
- The legacy "0–100 score" was retained during the v0.1.x refactor for
  backward compatibility and was retired in PR2. Removing it as part of
  the rename would have stacked two behaviour changes on one release.

## Why Rootmark, and why we accepted practical namespace cleanliness over perfect .com ownership

**Decision:** The product is named **Rootmark**, with the npm package
`rootmark`, the GitHub repository `northgardtracker/rootmark`, and the
CLI command `rootmark verify`.

**Reasoning:**

- **The npm name was free.** `rootmark` was available on the npm
  registry when we checked. That meant we could publish a package named
  `rootmark` without colliding with an existing CLI, library, or
  publisher. For an open-source CLI, an unclaimed npm name is the
  single most important namespace signal.
- **The repo name was usable.** `northgardtracker/rootmark` is available
  on GitHub and does not collide with the current owner of any repo
  under that path.
- **No CLI collision for end users.** There is no widely-used OSS CLI
  called `rootmark` that users would confuse this with.
- **The .com and the GitHub org are taken by unrelated parties.**
  `rootmark.com` is already registered by another organization, and
  `rootmark` as a GitHub organisation name is also taken by an unrelated
  party. Pursuing either of those would have required either negotiating
  with third parties or pivoting the name.

**What we accepted:**

- The marketing site for `rootmark.com` cannot be owned by this project
  in the near term. Documentation lives on GitHub Pages / the repo
  README instead.
- The GitHub organisation name is not `rootmark`; the project lives under
  the maintainer's existing personal or org namespace
  (`northgardtracker/rootmark`). A future transfer to a dedicated org is
  possible but not required for v0.1.
- The name is "good enough" rather than "perfect." It is short,
  pronounceable, fits the "grounded verification" thesis, and does not
  collide with anything the project actually depends on. That is the
  bar we set for v0.1.

If a future rename is warranted (for example, to align with a project
that does own the matching .com), the migration cost is concentrated in
the CLI binary name, the npm package name, and the GitHub repo path —
all of which are well-understood rename operations.

## Known issue: `rootmark verify . --help` does not print help

**Decision (PR0):** Document this as a known issue and defer the fix to PR1.
Do not patch it in PR0.

**Status:** **Resolved in PR1.**

**Symptom (before PR1):**

- `rootmark --help` and `rootmark verify --help` correctly print the CLI
  usage block and exit `0`.
- `rootmark verify . --help` does **not** print help. The CLI treats the
  extra `--help` flag as an unknown option and proceeds to run the verify
  subcommand against `.`, returning whatever exit code the scan would
  normally produce (typically `0` on a clean repo, `1` on findings).

**Resolution (PR1):**

The CLI now recognizes `--help` / `-h` anywhere in `argv` after the
`verify` subcommand is confirmed, before any root resolution or scan.
Both `rootmark verify --help` and `rootmark verify . --help` print the
usage block and exit `0` without running the scan. The existing
top-level `rootmark --help` behaviour is preserved, and a new CLI
integration test pins the post-subcommand behaviour.

## Why `--fail-on` now defaults to `off` (report-only)

**Decision (PR1):** The CLI default for `--fail-on` changes from
`error` to `off`, so `rootmark verify .` never fails CI on findings
unless the user explicitly opts in via `--fail-on warning|error`.

**Reasoning:**

- **Report-only is the safe default for an additive tool.** Rootmark
  is a static analyzer that produces findings; most users want to see
  the report first, then decide whether to gate CI on it. A default
  that fails builds on first install is hostile to adoption.
- **Opt-in gating is still first-class.** Users who want strict CI
  behaviour can pass `--fail-on warning` or `--fail-on error`
  explicitly. The GitHub Action wrapper continues to expose
  `fail-on` as an input so consumers can wire it into their workflows.
- **Exit-code semantics stay stable.** `0` = clean or report-only,
  `1` = gated failure, `2` = usage / path / format error. Only the
  *default* gate moved; the gate itself is unchanged.

**What we accepted:**

- Users who relied on the previous default to gate CI on `error`
  findings without passing `--fail-on error` will need to add the
  flag explicitly. The CHANGELOG and CLI help text call this out.
- The GitHub Action input `fail-on` still defaults to `error` because
  the action is a CI wrapper, not an interactive CLI. Changing that
  default would silently flip existing CI pipelines and is out of
  scope for PR1.


## Why `--fail-on` for the GitHub Action now defaults to `off`

**Decision (PR2):** The composite Action's `fail-on` input default
changes from `error` to `off`, matching the CLI default established
in PR1. An unset `FAIL_ON` environment variable is also treated as
`off` in `action/enforce-threshold.mjs`.

**Reasoning:**

- **Report-only by default is now the project-wide contract.** The CLI
  default landed in PR1; the Action was deliberately left with
  `error` as a temporary inconsistency to avoid flipping existing CI
  pipelines silently. PR2 finishes that alignment.
- **CI consumers who want gating still opt in explicitly.** Workflows
  that previously worked with the implicit `error` default must now
  set `fail-on: error` (or `fail-on: warning`) themselves. This is
  documented in `docs/github-actions.md` and called out in the
  CHANGELOG.

## Retired the 0–100 score

**Decision (PR2):** The legacy 0–100 aggregate score is removed from
`ScanResult`, the JSON output, the pretty CLI output, the PR comment
template, the GitHub Action output, and the rule descriptor catalog.

**Reasoning:**

- **A single aggregate score implies a quality grade Rootmark does not
  claim.** Grounded verification reports discrete findings; collapsing
  them into one number both hides information and invites the wrong
  mental model (Rootmark as a quality gate rather than a drift
  detector).
- **The score was already being deprecated.** The v0.1.x roadmap
  listed it as deferred; PR2 finishes the deprecation rather than
  shipping it indefinitely.
- **Pre-1.0, removing a documented output shape is acceptable.** The
  release notes call this out explicitly so consumers can adapt.
