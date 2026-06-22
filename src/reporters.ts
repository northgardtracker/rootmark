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

function severityToSarifLevel(severity: Severity): string {
  switch (severity) {
    case 'fail': return 'error';
    case 'warn': return 'warning';
    case 'info': return 'note';
  }
}

export function renderSarif(result: ScanResult): string {
  const SARIF_VERSION = '2.1.0';
  const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';

  const seenRuleIds = new Set<string>();
  const rules: Array<{
    id: string;
    name: string;
    shortDescription: { text: string };
    fullDescription: { text: string };
    help: { text: string };
  }> = [];

  for (const finding of result.findings) {
    if (seenRuleIds.has(finding.id)) continue;
    seenRuleIds.add(finding.id);
    rules.push({
      id: finding.id,
      name: finding.id,
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.message },
      help: { text: finding.remediation ?? finding.message },
    });
  }

  const sarifResults = result.findings.map((finding) => {
    let uri: string;
    if (finding.file) {
      uri = finding.file;
    } else if (result.files.length > 0) {
      uri = result.files[0];
    } else {
      uri = 'AGENTS.md';
    }

    return {
      ruleId: finding.id,
      level: severityToSarifLevel(finding.severity),
      message: { text: finding.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri },
          },
        },
      ],
    };
  });

  const sarif = {
    version: SARIF_VERSION,
    $schema: SARIF_SCHEMA,
    runs: [
      {
        tool: {
          driver: {
            name: 'agents-md-xray',
            informationUri: 'https://github.com/northgardtracker/agents-md-xray',
            rules,
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

export function shouldFail(result: ScanResult, failOn: Severity | 'off'): boolean {
  if (failOn === 'off') return false;
  const order: Record<Severity, number> = { info: 1, warn: 2, fail: 3 };
  return result.findings.some((f) => order[f.severity] >= order[failOn]);
}
