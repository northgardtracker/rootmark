// Runtime mirror of `src/action-comment.ts`.
//
// `dist/` is not committed to git (only published to npm), so the composite
// action in `action.yml` cannot import the compiled TypeScript helpers when a
// consumer checks this repo out as an Action. This ESM module re-implements the
// exact same pure functions using only built-in features.
//
// Keep this file byte-for-byte equivalent (in behaviour) to
// `src/action-comment.ts`. `test/action-comment.test.ts` imports BOTH modules
// and asserts their outputs are identical, so drift fails CI.
//
// Nothing in this module performs I/O or touches the network.

/** Hidden marker used to find and update the sticky PR comment in place. */
export const PR_COMMENT_MARKER = '<!-- agents-md-xray-pr-comment -->';

/** Maximum number of findings rendered in the PR comment table. */
export const MAX_FINDINGS_IN_COMMENT = 25;

const COMMENT_FOOTER =
  '<sub>Top-level summary from agents-md-xray. These are file-level findings; ' +
  'this is not an inline review because findings do not include line numbers yet.</sub>';

const SEVERITY_RANK = { info: 1, warn: 2, fail: 3 };

/** Map an internal severity (`info` | `warn` | `fail`) to its public label. */
export function severityLabel(severity) {
  if (severity === 'fail') return 'error';
  if (severity === 'warn') return 'warning';
  if (severity === 'info') return 'info';
  return severity;
}

/** Escape a user-controlled value for safe inclusion in a Markdown table cell. */
export function escapeTableCell(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/** Render the sticky PR comment body, including the hidden marker. */
export function renderComment(result, options = {}) {
  const max = options.maxFindings ?? MAX_FINDINGS_IN_COMMENT;
  const findings = Array.isArray(result.findings) ? result.findings : [];
  const files = Array.isArray(result.files) ? result.files : [];
  const score = typeof result.score === 'number' ? result.score : 0;

  const lines = [];
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

/**
 * Decide whether findings meet a `fail-on` threshold.
 * Throws on any value other than `error`, `warning`, or `off`.
 */
export function evaluateThreshold(findings, failOnRaw) {
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

/** Extract the action outputs (`score`, `findings-count`) from a scan result. */
export function summarize(result) {
  const score = typeof result.score === 'number' ? result.score : 0;
  const findingsCount = Array.isArray(result.findings) ? result.findings.length : 0;
  return { score, findingsCount };
}
