# Configuration File Design

Status: design only. Configuration file support is not implemented yet.

## Summary

This document describes a future configuration file format for `agents-md-xray`.

The goal is to let projects tune rule thresholds and override rule severity without changing the scanner source code, while preserving the existing zero-config default behavior.

## Non-goals

This design does not implement:

- configuration file loading
- YAML parser
- package.json-based config
- auto-fix mode
- dashboard
- enterprise policy engine
- network calls or LLM integration
- telemetry
- hosted service

## Current scanner model

`agents-md-xray` currently runs all checks with hardcoded thresholds.

Current behavior:

- scans instruction files found by exact name (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`)
- runs every rule on every matching file
- computes a score from hardcoded severity penalties
- never executes commands found in scanned files
- does not collect telemetry

Current hardcoded thresholds:

| Rule | Threshold | Default severity |
| :--- | :--- | :--- |
| `context-bloat.too-long` | `> 900` words | `warn` |
| `context-bloat.too-long` | `> 1600` words | `fail` |
| `required-section.*` | missing section | `fail` (setup, test); `warn` (style, safety, pr) |
| `dangerous-instruction.*` | regex match | `fail` |
| `stale-command.missing-package-script` | missing script | `fail` |

Current rule IDs are stable:

- `instruction-file.missing`
- `required-section.setup`
- `required-section.test`
- `required-section.style`
- `required-section.safety`
- `required-section.pr`
- `dangerous-instruction.system-override`
- `dangerous-instruction.skip-tests`
- `dangerous-instruction.reckless-write`
- `dangerous-instruction.secret-exposure`
- `context-bloat.too-long`
- `stale-command.missing-package-script`

## Proposed config file

Use a small JSON file named `agents-md-xray.config.json` at the scan root.

### Rationale

- JSON is built into Node.js without adding dependencies.
- YAML requires a parser dependency.
- `package.json` config is hidden and ambiguous; keep scanner config explicit and visible.

### Example

```json
{
  "rules": {
    "context-bloat.too-long": {
      "level": "warning",
      "maxWords": 500
    },
    "dangerous-instruction.skip-tests": {
      "level": "error"
    },
    "stale-command.missing-package-script": {
      "level": "off"
    }
  }
}
```

### `rules` format

Each key is a stable rule ID. Each value may contain:

- `level` (optional): one of `error`, `warning`, `info`, `off`.
  - `error` maps to internal severity `fail`.
  - `warning` maps to internal severity `warn`.
  - `info` maps to internal severity `info`.
  - `off` removes findings for that rule entirely.
- threshold keys (optional, rule-specific): for example, `maxWords` for `context-bloat.too-long`.

If a rule is absent from config, the hardcoded default remains unchanged.

## Public severity language

Config files should use public-facing severity names to stay consistent with the `--fail-on` CLI option.

| Config level | Internal severity |
| :--- | :--- |
| `error` | `fail` |
| `warning` | `warn` |
| `info` | `info` |
| `off` | disabled |

This matches the existing internal-to-public mapping used by `--fail-on`.

## Include/exclude behavior

The current scanner discovers instruction files by exact name. Full glob-based include/exclude is **not proposed in the first version**.

If needed in a future extension, the config could accept:

```json
{
  "include": [
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".github/copilot-instructions.md"
  ],
  "exclude": [
    "vendor/**",
    "dist/**",
    "node_modules/**"
  ]
}
```

These would only be honored if the implementation adds glob support. Until then, the scanner continues to use its built-in file discovery.

## CLI behavior proposal

Future SARIF support may already extend `--format`. Config should extend the CLI with `--config`:

```bash
agents-md-xray scan .
agents-md-xray scan . --config agents-md-xray.config.json
```

### Proposed behavior

- **No config file exists:** unchanged zero-config behavior. All hardcoded defaults apply.
- **With explicit `--config`:** load the named JSON file, merge overrides over hardcoded defaults, then scan.
- **Missing explicit config path:** exit code `2` with a concise error message.
- **Invalid JSON:** exit code `2` with a concise error message.
- **Invalid config schema:** exit code `2` with a concise error message.
- **Normal scan findings triggering `--fail-on`:** exit code `1`.
- **Clean scan:** exit code `0`.

The config loading step should run before scanning so that schema and JSON errors are caught early and treated as CLI usage errors.

## Backward compatibility

When no config file exists, behavior must remain exactly as it is today:

- default rule thresholds remain unchanged
- `--format pretty|json` remains unchanged
- `--json` alias remains unchanged
- `--fail-on warning|error|off` remains unchanged
- score calculation remains unchanged
- exit behavior remains unchanged

## Testing strategy for future implementation

A future implementation should include:

- no config file preserves current results for a stable fixture
- explicit missing config exits `2`
- invalid JSON exits `2`
- invalid config schema exits `2`
- rule severity override changes output and exit behavior
- context bloat threshold override changes the word-count cutoff
- disabled rule (`level: off`) does not emit findings
- config does not allow command execution
- config does not introduce network behavior
- default thresholds remain stable when config is absent

## Documentation updates for implementation PR

When config support is implemented, update:

- README CLI reference section
- `AGENTS.md` if it mentions current hardcoded behavior
- CHANGELOG for the release
- examples if helpful

Until implementation lands, public docs must continue to say configuration files are not supported yet.

## Open questions

- Should `include` and `exclude` ship in the first implementation or remain a future extension?
- Should the config schema ship with a published JSON Schema file for editor validation?
