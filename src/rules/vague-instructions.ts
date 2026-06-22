import type { Finding } from '../types.js';

/**
 * Detect instruction files that contain guidance but no actionable commands.
 *
 * An instruction file is considered actionable when it contains either:
 *   - at least one fenced code block (e.g. ```bash ... ```), or
 *   - at least one inline backtick-quoted span that starts with a known
 *     command/tool word such as `pnpm install`, `npm test`, or `pytest`.
 *
 * This complements the required-section rules: headings can exist without
 * commands, leaving agents with prose-only guidance like "write clean code".
 */

// Matches a fenced code block delimited by triple backticks on its own line.
// The opening fence may be followed by a language tag, and the closing fence
// must appear on its own line.
const FENCED_CODE_BLOCK_RE = /(?:^|\n)```[^\n`]*\n[\s\S]*?(?:\n|^)```/g;

// Matches a single inline backtick-quoted span that contains no other
// backtick and does not span across a line break.
const INLINE_BACKTICK_RE = /`([^`\n]+)`/g;

// Known command/tool words. When an inline backtick span starts with one of
// these (case-insensitive, whitespace-separated first token), the file is
// considered to carry actionable command evidence.
const COMMAND_PREFIXES = new Set([
  'npm',
  'pnpm',
  'yarn',
  'node',
  'npx',
  'go',
  'cargo',
  'python',
  'pytest',
  'uv',
  'pip',
  'ruff',
  'black',
  'eslint',
  'prettier',
  'tsc',
  'vitest',
  'docker',
  'kubectl'
]);

function hasFencedCodeBlock(text: string): boolean {
  FENCED_CODE_BLOCK_RE.lastIndex = 0;
  return FENCED_CODE_BLOCK_RE.test(text);
}

function hasInlineCommand(text: string): boolean {
  for (const match of text.matchAll(INLINE_BACKTICK_RE)) {
    const inner = match[1].trim();
    if (inner.length === 0) continue;
    const firstToken = (inner.split(/\s+/)[0] ?? '').toLowerCase();
    if (COMMAND_PREFIXES.has(firstToken)) {
      return true;
    }
  }
  return false;
}

export function vagueInstructions(file: string, text: string): Finding[] {
  if (hasFencedCodeBlock(text) || hasInlineCommand(text)) {
    return [];
  }
  return [
    {
      id: 'vague-instructions.no-commands',
      severity: 'warn',
      title: 'No actionable commands found',
      message:
        'This instruction file contains guidance but no concrete command examples: no fenced code blocks and no inline command backticks were detected.',
      file,
      remediation:
        'Add exact setup and validation commands such as `pnpm install` and `pnpm run ci`, ideally inside fenced code blocks, so agents know exactly what to run.'
    }
  ];
}
