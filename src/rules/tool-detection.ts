/**
 * Shared deterministic tool-detection helpers used by `contradictory-rules`
 * (same-file contradictions) and `nested-conflicts` (parent vs child
 * contradictions).
 *
 * All matching is:
 *  - case-insensitive
 *  - uses strict boundaries (`(?<![A-Za-z0-9_-])...(?![A-Za-z0-9_-])`)
 *    so short tool names are NOT matched inside hyphenated identifiers
 *    like `run-ava-tests` or longer words like `npmpkg`
 *  - deterministic and regex-based (no NLP, no network)
 */

/** A category groups competing tools (lint, test, package manager, ...). */
export interface ToolCategory {
  /** Short identifier used in deterministic evidence strings. */
  id: string;
  /** Human-readable category label used in messages. */
  label: string;
  /** Lowercase tool names. Matching is case-insensitive with strict boundaries. */
  tools: readonly string[];
}

/**
 * The categories this scanner currently understands.
 * Exported so other rule modules can reuse the same lists and stay in sync.
 */
export const TOOL_CATEGORIES: readonly ToolCategory[] = [
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
 * considered competing (same-file proximity check).
 */
export const PROXIMITY_LIMIT = 500;

/**
 * Find all character positions where any tool from `tools` appears in `text`.
 * Uses negative lookbehind/lookahead around [A-Za-z0-9_-] so tool names are
 * not detected inside hyphenated identifiers like `run-ava-tests` or
 * `my-npm-wrapper`, and not inside longer words like `npmpkg`.
 */
export function findToolPositions(
  text: string,
  tools: readonly string[]
): Map<string, number[]> {
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
 * Return the subset of `tools` that appear at least once in `text`.
 */
export function findMentionedTools(text: string, tools: readonly string[]): string[] {
  return Array.from(findToolPositions(text, tools).keys());
}

/**
 * Check if the text between or near two tool mentions contains a scoped
 * boundary indicator (currently just the word "only"). This handles patterns
 * like "Use Biome only for generated files" where the tool is explicitly
 * scoped to a specific context.
 */
export function hasScopedBoundary(text: string, posA: number, posB: number): boolean {
  const start = Math.min(posA, posB);
  const end = Math.max(posA, posB);
  const windowStart = Math.max(0, start - 100);
  const windowEnd = Math.min(text.length, end + 100);
  const window = text.substring(windowStart, windowEnd);
  return /\bonly\b/i.test(window);
}

/**
 * Check if a specific tool mention in `text` is scoped with "only" nearby.
 * Used by the nested-conflicts rule to decide whether a child's use of a
 * tool constitutes an explicit override of the parent rather than a
 * default contradiction.
 */
export function hasScopedToolUsage(text: string, tool: string): boolean {
  const positions = findToolPositions(text, [tool]).get(tool) ?? [];
  for (const pos of positions) {
    const windowStart = Math.max(0, pos - 100);
    const windowEnd = Math.min(text.length, pos + 100);
    if (/\bonly\b/i.test(text.substring(windowStart, windowEnd))) return true;
  }
  return false;
}
