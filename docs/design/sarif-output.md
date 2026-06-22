# SARIF Output Design

Status: initial implementation completed. SARIF output is available via `--format sarif`.

## Summary

This document describes a future SARIF output mode for `agents-md-xray`.

The goal is to let CI systems and code scanning tools consume scanner findings in a standard JSON-based format while preserving the current static-analysis-only safety model.

## Non-goals

This design does not implement:

- GitHub Code Scanning upload
- a GitHub Marketplace Action
- PR comments
- auto-fix
- hosted dashboards
- telemetry
- network uploads

## Current scanner model

`agents-md-xray` currently reports deterministic findings from local files.

Current behavior:

- scans local instruction files
- runs rule-based checks
- reports findings in pretty text, JSON, or SARIF
- never executes commands found in scanned files
- does not collect telemetry
- does not upload scanned content by default

## Proposed CLI shape

Future SARIF support should extend the existing `--format` flag:

```bash
agents-md-xray scan . --format sarif
```

The existing JSON format should remain unchanged.

The future supported values would become:

```text
pretty
json
sarif
```

No separate `--sarif` alias is proposed for the first implementation, to keep the CLI small.

## SARIF version

Use SARIF version `2.1.0`.

The output should set:

```json
{
  "version": "2.1.0",
  "$schema": "https://json.schemastore.org/sarif-2.1.0.json"
}
```

## Severity mapping

Current internal finding severities should map to SARIF levels as follows:

| Current severity | SARIF level |
| --- | --- |
| `fail` | `error` |
| `warn` | `warning` |
| `info` | `note` |

If the implementation exposes public severity names in output, map them as follows:

| Public severity | SARIF level |
| --- | --- |
| `error` | `error` |
| `warning` | `warning` |
| `info` | `note` |

## Rule mapping

Each scanner rule should become one SARIF `reportingDescriptor`.

Current rule IDs are:

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

Each SARIF rule should include:

- `id`
- `name`
- `shortDescription.text`
- `fullDescription.text`
- `help.text`

The rule help text should reuse existing remediation text where possible.

## Result mapping

Each scanner finding should become one SARIF `result`.

Suggested fields:

```json
{
  "ruleId": "dangerous-instruction.system-override",
  "level": "error",
  "message": {
    "text": "Instruction override language can behave like prompt injection."
  },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": {
          "uri": "AGENTS.md"
        }
      }
    }
  ]
}
```

If a finding does not currently include a line number, omit `region` rather than inventing one.

If a finding points to the repository root rather than a file, use the most relevant scanned file when possible. Otherwise, use a stable placeholder location only if SARIF consumers require one.

## Paths

SARIF artifact URIs should be repository-relative paths using forward slashes.

Examples:

```text
AGENTS.md
.github/copilot-instructions.md
docs/agents/CLAUDE.md
```

Do not emit absolute local paths by default.

## Invocation metadata

The SARIF run should include basic tool metadata:

```json
{
  "tool": {
    "driver": {
      "name": "agents-md-xray",
      "informationUri": "https://github.com/northgardtracker/agents-md-xray",
      "rules": []
    }
  }
}
```

Future implementation may include the package version if it is already available without adding runtime complexity.

## Exit behavior

SARIF output should not change failure behavior.

`--fail-on` should continue to control the process exit code:

- `--fail-on warning`: fail on warning/error findings
- `--fail-on error`: fail on error findings only
- `--fail-on off`: never fail based on findings

SARIF output should still be emitted even when the process exits with code `1`.

CLI usage errors should continue to exit with code `2`.

## Testing strategy

A future implementation should include:

- unit tests for severity mapping
- unit tests for rule descriptor generation
- integration test for `--format sarif`
- JSON schema-like structural validation
- snapshot or stable object comparison for a small fixture
- test that SARIF output does not include absolute local paths
- test that exit behavior remains controlled by `--fail-on`

## Documentation updates for implementation PR

The following were updated when SARIF was implemented:

- README CLI reference
- `docs/github-actions.md`
- CHANGELOG `Unreleased` section
- examples if helpful

## Open questions

- Should SARIF output include package version in `semanticVersion`?
- Should findings without line numbers point to file-level locations only?
- Should `--format sarif` be allowed with `--fail-on off` for report-only CI jobs?
- Should future GitHub Code Scanning upload remain a separate documentation task rather than built-in behavior?
