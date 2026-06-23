# Rootmark Roadmap

This document describes what Rootmark is and is not in v0.1, and what is
deliberately deferred to later versions.

## v0.1 scope

v0.1 ships grounded verification for `AGENTS.md`-style instruction files in
Node/npm/pnpm repositories:

- **Discover** instruction files by exact name:
  `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`.
- **Extract** `npm`, `pnpm`, and `yarn` commands from fenced code blocks
  inside the discovered instruction files.
- **Ground** each extracted command against the repository's package
  metadata: `package.json` scripts, the `packageManager` field, lockfiles,
  and pnpm workspaces.
- **Report** each command reference as one of three states:
  `verified`, `missing`, or `cannot_verify`.
- **Report-only by default**: a clean scan does not fail CI unless the user
  explicitly opts in via `--fail-on`.
- **GitHub Action**: ship a composite `action.yml` that runs the CLI and
  can post a sticky PR summary job summary (no inline review comments
  yet — findings are still file-level).

## Not doing in v0.1 (deliberately deferred)

The following are out of scope for v0.1 and will be reconsidered in later
releases. They are listed here so contributors and users can see them in
one place:

- **Command execution** — Rootmark never runs commands discovered inside
  scanned instruction files. This is a hard safety boundary.
- **Non-Node ecosystems** — Python (`uv`, `pip`, `pytest`, `ruff`), Rust
  (`cargo`), Go, and other package managers are not grounded in v0.1.
- **Prose mining** — Rootmark does not grade writing style, tone, or
  clarity. It is not an `AGENTS.md` linter for prose.
- **LLM / semantic checks** — no model calls, no embeddings, no natural
  language analysis. All checks are deterministic and regex/string-based.
- **Security / vulnerability detection** — Rootmark is not a CVE scanner,
  dependency auditor, or SAST tool. It does not claim to detect
  vulnerabilities.
- **SARIF as a product feature** — SARIF output remains available via
  `--format sarif` (it works), but it is not a headline capability and
  no first-party upload to GitHub Code Scanning ships in v0.1.
- **PR comments** as a headline feature — the action can post a sticky
  top-level PR summary comment, but inline review comments are not
  implemented because findings do not yet carry line numbers.
- **GitHub Marketplace publish** — publishing the action to the
  Marketplace is a separate, manual release step that this repository
  does not perform automatically.
- **`CLAUDE.md` / `GEMINI.md` first-class grounding** — v0.1 treats all
  discovered instruction files uniformly. Tool-specific grounding rules
  (for example, Claude-specific or Gemini-specific conventions) are
  deferred.
- **Auto-fix / auto-write** — Rootmark never modifies instruction files.
  It reports findings; the maintainer decides what to change.
- **Configuration file** — v0.1 uses hardcoded defaults. A future
  configuration file is in design only
  ([`docs/design/configuration.md`](docs/design/configuration.md)).
