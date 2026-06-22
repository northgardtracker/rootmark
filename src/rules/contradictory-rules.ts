import type { Finding } from '../types.js';
import {
  TOOL_CATEGORIES,
  PROXIMITY_LIMIT,
  findToolPositions,
  hasScopedBoundary,
} from './tool-detection.js';

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
 *
 * Shared helpers (categories, tool positions, scoped boundary) live in
 * `./tool-detection.ts` so the nested-conflicts rule can reuse them.
 */

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
  for (const category of TOOL_CATEGORIES) {
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
