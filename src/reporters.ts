import type { ScanResult, Severity } from './types.js';

export function renderText(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`agents-md-xray score: ${result.score}/100`);
  lines.push(`instruction files: ${result.files.length ? result.files.join(', ') : 'none'}`);
  lines.push('');

  if (result.findings.length === 0) {
    lines.push('No findings.');
    return lines.join('\n');
  }

  for (const finding of result.findings) {
    const location = finding.file ? ` (${finding.file})` : '';
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.id}${location}`);
    lines.push(`  ${finding.title}: ${finding.message}`);
    if (finding.evidence) lines.push(`  Evidence: ${finding.evidence}`);
    if (finding.remediation) lines.push(`  Fix: ${finding.remediation}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function renderJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function shouldFail(result: ScanResult, failOn: Severity | 'off'): boolean {
  if (failOn === 'off') return false;
  const order: Record<Severity, number> = { info: 1, warn: 2, fail: 3 };
  return result.findings.some((f) => order[f.severity] >= order[failOn]);
}
