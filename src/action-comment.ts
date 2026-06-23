/**
 * Pure helpers for the GitHub Action wrapper (see root `action.yml`).
 *
 * This module is the canonical, type-checked, unit-tested implementation of
 * the PR comment rendering and the `fail-on` threshold logic. The GitHub
 * Action cannot import this compiled module at runtime because `dist/` is not
 * committed to git (it is only published to npm), so `action/lib.mjs` holds a
 * hand-kept ESM mirror of these same functions. `test/action-comment.test.ts`
 * unit-tests this module and asserts byte-for-byte parity with that mirror, so
 * the two implementations cannot silently drift.
 *
 * Nothing in this module performs I/O or touches the network.
 */
import type { Finding, ScanResult } from './types.js';

/** Hidden marker used to find and update the sticky PR comment in place. */
export const PR_COMMENT_MARKER = '<!-- agents-md-xray-pr-comment -->';

/** Maximum number of findings rendered in the PR comment table. */
export const MAX_FINDINGS_IN_COMMENT = 25;

/** Footer noting that this is a file-level summary, not an inline review. */
const COMMENT_FOOTER =
  '<sub>Top-level summary from agents-md-xray. These are file-level findings; ' +
  'this is not an inline review because findings do not include line numbers yet.</sub>';

/** Internal severity ranks, shared by the threshold logic. */
const SEVERITY_RANK: Record<string, number> = { info: 1, warn: 2, fail: 3 };

/** Map an internal severity (`info` | `warn` | `fail`) to its public label. */
export function severityLabel(severity: string): string {
  if (severity === 'fail') return 'error';
  if (severity === 'warn') return 'warning';
  if (severity === 'info') return 'info';
  return severity;
}

/**
 * Escape a user-controlled value for safe inclusion in a Markdown table cell.
 *
 * Collapses newlines to spaces and escapes pipe characters so that untrusted
 * evidence/remediation text from scanned files cannot break the table layout.
 */
export function escapeTableCell(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

export interface RenderOptions {
  /** Maximum findings to show in the table (default {@link MAX_FINDINGS_IN_COMMENT}). */
  maxFindings?: number;
  /** Optional link to the workflow run, referenced when findings are omitted. */
  detailsUrl?: string;
}

/**
 * Render the sticky PR comment body, including the hidden marker on the first
 * line. Pure function: the same input always produces the same Markdown.
 */
export function renderComment(result: ScanResult, options: RenderOptions = {}): string {
  const max = options.maxFindings ?? MAX_FINDINGS_IN_COMMENT;
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const files = Array.isArray(result.files) ? result.files : [];
  const score = typeof result.score === 'number' ? result.score : 0;

  const lines: string[] = [];
  lines.push(PR_COMMENT_MARKER);
  lines.push('## agents-md-xray report');
  lines.push('');
  lines.push(`- **Score:** ${score}/100`);
  lines.push(`- **Instruction files scanned:** ${files.length}`);
  lines.push(`- **Findings:** ${findings.length}`);
  lines.push('');

  if (findings.length === 0) {
    lines.push('No findings.');
    lines.push('');
    lines.push(COMMENT_FOOTER);
    return lines.join('\n');
  }

  const shown = findings.slice(0, max);
  const omitted = findings.length - shown.length;

  lines.push('| Severity | Rule | File | Evidence | Remediation |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const finding of shown) {
    lines.push(
      `| ${severityLabel(finding.severity)} | ${escapeTableCell(finding.id)} | ` +
        `${escapeTableCell(finding.file)} | ${escapeTableCell(finding.evidence)} | ` +
        `${escapeTableCell(finding.remediation)} |`,
    );
  }
  lines.push('');

  if (omitted > 0) {
    const more = omitted === 1 ? '1 more finding' : `${omitted} more findings`;
    const where = options.detailsUrl
      ? `the [workflow logs](${options.detailsUrl}) or the JSON output`
      : 'the workflow logs or the JSON output';
    lines.push(`_…and ${more} not shown. See ${where} for the full list._`);
    lines.push('');
  }

  lines.push(COMMENT_FOOTER);
  return lines.join('\n');
}

export type FailOn = 'off' | 'warning' | 'error';

export interface ThresholdOutcome {
  shouldFail: boolean;
  failOn: FailOn;
}

/**
 * Decide whether findings meet a `fail-on` threshold.
 *
 * - `error`   fails on internal severity `fail`
 * - `warning` fails on internal severity `warn` or `fail`
 * - `off`     never fails
 *
 * Throws on any other value so the action surfaces a clear configuration error
 * instead of silently picking a default.
 */
export function evaluateThreshold(findings: Finding[], failOnRaw: string): ThresholdOutcome {
  const value = String(failOnRaw ?? '').trim().toLowerCase();
  if (value !== 'off' && value !== 'warning' && value !== 'error') {
    throw new Error(`Invalid fail-on value: "${failOnRaw}". Supported values: error, warning, off.`);
  }
  if (value === 'off') {
    return { shouldFail: false, failOn: 'off' };
  }
  const threshold = value === 'warning' ? SEVERITY_RANK.warn : SEVERITY_RANK.fail;
  const list = Array.isArray(findings) ? findings : [];
  const shouldFail = list.some((finding) => (SEVERITY_RANK[finding.severity] ?? 0) >= threshold);
  return { shouldFail, failOn: value };
}

export interface ScanSummary {
  score: number;
  findingsCount: number;
}

/** Extract the action outputs (`score`, `findings-count`) from a scan result. */
export function summarize(result: ScanResult): ScanSummary {
  const score = typeof result.score === 'number' ? result.score : 0;
  const findingsCount = Array.isArray(result.findings) ? result.findings.length : 0;
  return { score, findingsCount };
}
