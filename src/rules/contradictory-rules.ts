import type { Finding } from '../types.js';

/**
 * Detect instruction files that reference competing tools within the same
 * category (for example, ESLint and Biome for linting, or Jest and Vitest
 * for testing).
 *
 * This is a heuristic, deterministic, regex-based check. It is not a semantic
 * analyzer and will not detect every contradiction. It warns when the same
 * instruction file mentions 2+ tools from the same category, which is a
 * common source of confusion for coding agents.
 *
 * One finding is emitted per category per file. If a file has conflicts in
 * multiple categories, multiple findings are emitted.
 *
 * Three heuristics reduce false positives:
 *
 * 1. Proximity: two tools are considered competing only when at least one
 *    occurrence of each appears within PROXIMITY_LIMIT characters of the
 *    other. This avoids flagging when a tool is merely mentioned as an
 *    example in a distant part of the file.
 *
 * 2. Scoped boundary exemption: if the text between or near the two tool
 *    mentions contains the word "only" (for example, "Use Biome only for
 *    generated files"), the pair is treated as a documented boundary and
 *    not flagged.
 *
 * 3. Strict word boundaries: tool names are matched with negative lookbehind
 *    and lookahead around [A-Za-z0-9_-] so they are not detected inside
 *    hyphenated identifiers like `run-ava-tests` or `my-npm-wrapper`.
 */

interface Category {
  /** Short identifier used in deterministic evidence strings. */
  id: string;
  /** Human-readable category label used in messages. */
  label: string;
  /** Lowercase tool names. Matching is case-insensitive with strict boundaries. */
  tools: string[];
}

const CATEGORIES: readonly Category[] = [
  {
    id: 'lint',
    label: 'lint/format',
    tools: ['eslint', 'biome', 'prettier', 'ruff', 'black']
  },
  {
    id: 'test',
    label: 'JavaScript/TypeScript test',
    tools: ['jest', 'vitest', 'mocha', 'ava']
  },
  {
    id: 'package-manager',
    label: 'package manager',
    tools: ['npm', 'pnpm', 'yarn']
  }
];

/**
 * Maximum character distance between two tool mentions for them to be
 * considered competing. Tuned to catch contradictions within the same
 * paragraph or section while avoiding false positives across distant parts
 * of a long instruction file.
 */
const PROXIMITY_LIMIT = 500;

/**
 * Find all character positions where any tool from `tools` appears in `text`.
 * Uses negative lookbehind/lookahead around [A-Za-z0-9_-] so tool names are
 * not detected inside hyphenated identifiers like `run-ava-tests` or
 * `my-npm-wrapper`.
 */
function findToolPositions(text: string, tools: readonly string[]): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  for (const tool of tools) {
    const re = new RegExp('(?<![A-Za-z0-9_-])' + tool + '(?![A-Za-z0-9_-])', 'gi');
    const found: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      found.push(m.index);
    }
    if (found.length > 0) positions.set(tool, found);
  }
  return positions;
}

/**
 * Check if the text between or near two tool mentions contains a scoped
 * boundary indicator (currently just the word "only"). This handles patterns
 * like "Use Biome only for generated files" where the tool is explicitly
 * scoped to a specific context.
 */
function hasScopedBoundary(text: string, posA: number, posB: number): boolean {
  const start = Math.min(posA, posB);
  const end = Math.max(posA, posB);
  // Look for "only" in a window from 100 chars before the earlier tool
  // mention to 100 chars after the later one.
  const windowStart = Math.max(0, start - 100);
  const windowEnd = Math.min(text.length, end + 100);
  const window = text.substring(windowStart, windowEnd);
  return /\bonly\b/i.test(window);
}

/**
 * Given a map of tool -> positions, return the subset of tools that have at
 * least one pair of occurrences within PROXIMITY_LIMIT characters of each
 * other AND that pair is not a documented scoped boundary.
 */
function findCompetingTools(positions: Map<string, number[]>, text: string): string[] {
  const competing = new Set<string>();
  const names = Array.from(positions.keys());
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const posA = positions.get(a) ?? [];
      const posB = positions.get(b) ?? [];
      let isCompeting = false;
      outer: for (const pA of posA) {
        for (const pB of posB) {
          if (Math.abs(pA - pB) <= PROXIMITY_LIMIT) {
            if (!hasScopedBoundary(text, pA, pB)) {
              isCompeting = true;
              break outer;
            }
          }
        }
      }
      if (isCompeting) {
        competing.add(a);
        competing.add(b);
      }
    }
  }
  return Array.from(competing);
}

export function contradictoryRules(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  for (const category of CATEGORIES) {
    const positions = findToolPositions(text, category.tools);
    const competing = findCompetingTools(positions, text);
    if (competing.length < 2) continue;

    // Sort for deterministic evidence regardless of tool order in the file.
    const sorted = [...competing].sort();
    findings.push({
      id: 'contradictory-rules.duplicate-tool-reference',
      severity: 'warn',
      title: 'Competing tool references found',
      message:
        `Instruction file references competing ${category.label} tools: ${sorted.join(', ')}. ` +
        'Multiple competing tools in the same category can confuse the agent.',
      file,
      evidence: `${category.id}: ${sorted.join(', ')}`,
      remediation:
        `Pick one preferred ${category.label} tool, or clearly document when each tool applies ` +
        '(for example, "use ESLint for app code and Biome only for generated files").'
    });
  }
  return findings;
}
