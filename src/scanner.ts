import { findInstructionFiles, loadPackageScripts, readText, rel } from './utils.js';
import type { ScanOptions, ScanResult, Finding } from './types.js';
import { requiredSections } from './rules/required-sections.js';
import { dangerousInstructions } from './rules/dangerous-instructions.js';
import { contextBloat } from './rules/context-bloat.js';
import { staleCommands } from './rules/stale-commands.js';
import { vagueInstructions } from './rules/vague-instructions.js';
import { contradictoryRules } from './rules/contradictory-rules.js';
import {
  nestedToolConflicts,
  nestedMissingOverride,
  type InstructionFile,
} from './rules/nested-conflicts.js';

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

  // Read every instruction file once, then run per-file rules and nested
  // rules over the same in-memory list.
  const instructionFiles: InstructionFile[] = [];
  for (const absolute of files) {
    const file = rel(options.root, absolute);
    const text = readText(absolute);
    instructionFiles.push({ absolute, file, text });
  }

  // Grounding rules run on every scan (instructions vs repository reality).
  // Prose/style and risky-instruction heuristics are gated behind --strict
  // because they grade writing quality, not whether commands actually work.
  const strict = options.strict === true;
  for (const instr of instructionFiles) {
    if (strict) {
      findings.push(...requiredSections(instr.file, instr.text));
      findings.push(...dangerousInstructions(instr.file, instr.text));
      findings.push(...contextBloat(instr.file, instr.text));
      findings.push(...vagueInstructions(instr.file, instr.text));
    }
    findings.push(...staleCommands(instr.file, instr.text, packageScripts));
    findings.push(...contradictoryRules(instr.file, instr.text));
  }

  // Nested rules run after per-file rules. They compare files against each
  // other, so they need the full list.
  findings.push(...nestedToolConflicts(instructionFiles));
  findings.push(...nestedMissingOverride(instructionFiles, options.root));

  return { root: options.root, files: files.map((f) => rel(options.root, f)), findings };
}
