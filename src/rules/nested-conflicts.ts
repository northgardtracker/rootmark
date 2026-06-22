import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Finding } from '../types.js';
import {
  TOOL_CATEGORIES,
  findMentionedTools,
  hasScopedToolUsage,
} from './tool-detection.js';

/**
 * Detect conflicts between nested instruction files in monorepos.
 *
 * Two rules:
 *
 * 1. `nested-conflict.contradictory-tools` - parent and child instruction
 *    files reference different default tools in the same category.
 *
 * 2. `nested-conflict.missing-override` - a package/workspace directory
    (detected by `package.json`) has no local instruction file while an
 *    ancestor instruction file contains broad repo-wide wording.
 *
 * Both rules are deterministic, regex/string-based, and local. They do not
 * analyze workspace graphs, package.json dependencies, or MCP configs.
 */

/** An instruction file discovered by the scanner, with repo-relative path. */
export interface InstructionFile {
  absolute: string;
  file: string;
  text: string;
}

/**
 * Directories the walker should ignore, mirroring the ignore list in
 * `src/utils.ts` so nested scans stay consistent with the top-level scan.
 */
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  'test',
  'tests',
  '__tests__'
]);

/** Names that count as local instruction files for the missing-override rule. */
const INSTRUCTION_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];

/**
 * Patterns that indicate a parent instruction file uses broad repo-wide
 * wording. These are intentionally narrow: they look for explicit
 * repo-wide scope language rather than generic instructions.
 */
const BROAD_PARENT_PATTERNS: RegExp[] = [
  /\ball\s+packages\b/i,
  /\ball\s+workspaces\b/i,
  /\bentire\s+repo(?:sitory)?\b/i,
  /\brepository-wide\b/i,
  /\bevery\s+package\b/i,
  /\ball\s+subdirectories\b/i
];

/**
 * Check whether `ancestor` is an ancestor directory of `descendant`.
 * Both arguments are repo-relative forward-slash paths.
 */
function isAncestorDir(ancestorDir: string, descendantDir: string): boolean {
  const a = ancestorDir === '.' ? '' : ancestorDir;
  const d = descendantDir === '.' ? '' : descendantDir;
  if (a === '') return d !== '';
  if (d === '') return false;
  if (a === d) return false;
  return d === a || d.startsWith(a + '/');
}

/**
 * Check whether `ancestor` is an ancestor (or same) instruction file of
 * `descendant` based on their directory paths.
 */
function isAncestorFile(ancestor: string, descendant: string): boolean {
  if (ancestor === descendant) return false;
  return isAncestorDir(dirname(ancestor), dirname(descendant));
}

/**
 * Check whether the text contains broad repo-wide wording.
 */
function isBroadParent(text: string): boolean {
  return BROAD_PARENT_PATTERNS.some((p) => p.test(text));
}

/**
 * Walk the repo and return directories that contain a `package.json`.
 * Excludes the walker-ignored directories. Results are deterministic
 * because the directory list is sorted before returning.
 */
export function findPackageDirs(root: string): string[] {
  const dirs: string[] = [];
  walk(root, (absPath, name) => {
    if (name === 'package.json') {
      dirs.push(dirname(absPath).replaceAll('\\', '/'));
    }
  });
  return dirs.sort();
}

/**
 * Check whether `dir` contains any local instruction file.
 */
export function hasLocalInstructionFile(dir: string): boolean {
  for (const name of INSTRUCTION_FILE_NAMES) {
    if (existsSync(join(dir, name))) return true;
  }
  // Also check the nested copilot location.
  if (existsSync(join(dir, '.github', 'copilot-instructions.md'))) return true;
  return false;
}

/**
 * Find the nearest ancestor instruction file for `dir`. Returns `undefined`
 * if none exists.
 */
function findNearestAncestorInstruction(
  dir: string,
  instructionFiles: InstructionFile[]
): InstructionFile | undefined {
  // Sort by directory depth descending (longer dir path = deeper in tree =
  // closer to the target package, i.e. the nearest ancestor). This way a
  // package-scoped AGENTS.md is preferred over the repo-root AGENTS.md.
  const sorted = [...instructionFiles].sort(
    (a, b) => dirname(b.file).length - dirname(a.file).length
  );
  for (const instr of sorted) {
    if (isAncestorDir(dirname(instr.file), dir)) {
      return instr;
    }
  }
  return undefined;
}

/**
 * Recursive directory walker. Skips ignored directories. Calls `onFile`
 * for every regular file encountered.
 */
function walk(dir: string, onFile: (absPath: string, name: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, onFile);
    } else if (st.isFile()) {
      onFile(full, entry);
    }
  }
}

/**
 * Rule: parent and child instruction files reference different default
 * tools in the same category (nested-conflict.contradictory-tools).
 */
export function nestedToolConflicts(
  instructionFiles: InstructionFile[]
): Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i < instructionFiles.length; i++) {
    for (let j = 0; j < instructionFiles.length; j++) {
      if (i === j) continue;
      const parent = instructionFiles[i];
      const child = instructionFiles[j];
      if (!isAncestorFile(parent.file, child.file)) continue;

      for (const category of TOOL_CATEGORIES) {
        const parentTools = findMentionedTools(parent.text, category.tools);
        const childTools = findMentionedTools(child.text, category.tools);
        if (parentTools.length === 0 || childTools.length === 0) continue;

        const parentSet = new Set(parentTools);
        const childSet = new Set(childTools);

        // Tools the child introduces that the parent does not mention.
        const childOnlyTools = childTools.filter((t) => !parentSet.has(t));
        // Tools the parent mentions that the child does not.
        const parentOnlyTools = parentTools.filter((t) => !childSet.has(t));

        // No real difference: both files reference the same tool set.
        if (childOnlyTools.length === 0 && parentOnlyTools.length === 0) continue;

        // If the child clearly scopes its divergent tool with "only",
        // treat it as an explicit override rather than a contradiction.
        if (
          childOnlyTools.length > 0 &&
          childOnlyTools.every((t) => hasScopedToolUsage(child.text, t))
        ) {
          continue;
        }

        // Build deterministic evidence. Include both sides so the reader
        // can see what the parent says versus what the child says.
        const parentLabel = [...parentSet].sort().join(', ');
        const childLabel = [...childSet].sort().join(', ');
        const evidence =
          `${parent.file} -> ${child.file} | ${category.id}: ${parentLabel} -> ${childLabel}`;

        findings.push({
          id: 'nested-conflict.contradictory-tools',
          severity: 'warn',
          title: 'Nested instruction files reference competing tools',
          message:
            `Parent ${parent.file} and child ${child.file} reference different ` +
            `${category.label} tools (${parentLabel} vs ${childLabel}). ` +
            'Nested instruction files should align on tool defaults or explicitly document the override.',
          file: child.file,
          evidence,
          remediation:
            `Align the ${category.label} tool between ${parent.file} and ` +
            `${child.file}, or clearly document the override boundary ` +
            '(for example, "Use Biome only for generated files").'
        });
      }
    }
  }
  return findings;
}

/**
 * Rule: a package/workspace directory lacks a local instruction file while
 * an ancestor instruction file contains broad repo-wide wording
 * (nested-conflict.missing-override).
 */
export function nestedMissingOverride(
  instructionFiles: InstructionFile[],
  root: string
): Finding[] {
  const findings: Finding[] = [];
  const packageDirs = findPackageDirs(root);

  for (const pkgDir of packageDirs) {
    // Skip the root package itself.
    const pkgRel = relative(root, pkgDir).replaceAll('\\', '/');
    if (pkgRel === '' || pkgRel === '.') continue;

    // Skip directories that already have a local instruction file.
    if (hasLocalInstructionFile(pkgDir)) continue;

    // Find the nearest ancestor instruction file with broad wording.
    const ancestor = findNearestAncestorInstruction(pkgRel, instructionFiles);
    if (!ancestor) continue;
    if (!isBroadParent(ancestor.text)) continue;

    findings.push({
      id: 'nested-conflict.missing-override',
      severity: 'warn',
      title: 'Package directory has no local instruction override',
      message:
        `Package directory ${pkgRel} has a package.json but no local ` +
        `instruction file, while parent ${ancestor.file} contains broad ` +
        'repo-wide guidance that may not apply to this package.',
      file: ancestor.file,
      evidence: `${pkgRel} has package.json but no local instruction file`,
      remediation:
        `Add a local ${INSTRUCTION_FILE_NAMES[0]} (or equivalent) in ${pkgRel}, ` +
        `or clarify in ${ancestor.file} that the broad guidance intentionally ` +
        'applies to every package.'
    });
  }
  return findings;
}

/**
 * Entry point that runs both nested rules. Kept for convenience; the
 * scanner wires them individually for clearer ordering.
 */
export function nestedConflicts(
  instructionFiles: InstructionFile[],
  root: string
): Finding[] {
  return [
    ...nestedToolConflicts(instructionFiles),
    ...nestedMissingOverride(instructionFiles, root)
  ];
}
