import { findInstructionFiles, loadPackageScripts, readText, rel } from './utils.js';
import type { ScanOptions, ScanResult, Finding } from './types.js';
import { requiredSections } from './rules/required-sections.js';
import { dangerousInstructions } from './rules/dangerous-instructions.js';
import { contextBloat } from './rules/context-bloat.js';
import { staleCommands } from './rules/stale-commands.js';
import { vagueInstructions } from './rules/vague-instructions.js';

export function scan(options: ScanOptions): ScanResult {
  const files = findInstructionFiles(options.root);
  const packageScripts = loadPackageScripts(options.root);
  const findings: Finding[] = [];

  if (files.length === 0) {
    findings.push({
      id: 'instruction-file.missing',
      severity: 'fail',
      title: 'No agent instruction file found',
      message: 'No AGENTS.md, CLAUDE.md, GEMINI.md, or .github/copilot-instructions.md file was found.',
      remediation: 'Add AGENTS.md with setup commands, validation commands, code style, and safety boundaries.'
    });
  }

  for (const absolute of files) {
    const file = rel(options.root, absolute);
    const text = readText(absolute);
    findings.push(...requiredSections(file, text));
    findings.push(...dangerousInstructions(file, text));
    findings.push(...contextBloat(file, text));
    findings.push(...staleCommands(file, text, packageScripts));
    findings.push(...vagueInstructions(file, text));
  }

  const score = scoreFindings(findings);
  return { root: options.root, score, files: files.map((f) => rel(options.root, f)), findings };
}

function scoreFindings(findings: Finding[]): number {
  const penalty = findings.reduce((sum, finding) => {
    if (finding.severity === 'fail') return sum + 18;
    if (finding.severity === 'warn') return sum + 7;
    return sum + 2;
  }, 0);
  return Math.max(0, 100 - penalty);
}
