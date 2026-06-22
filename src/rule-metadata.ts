/**
 * Centralized metadata catalog for all known scanner rules.
 *
 * This catalog is the source of truth for SARIF `reportingDescriptor` entries.
 * It allows `--format sarif` to emit a stable rule catalog even on clean scans
 * (where `result.findings.length === 0`).
 */

export interface RuleMetadata {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  help: { text: string };
}

export const RULE_METADATA: readonly RuleMetadata[] = [
  {
    id: 'instruction-file.missing',
    name: 'Missing agent instruction file',
    shortDescription: { text: 'No recognized agent instruction file was found.' },
    fullDescription: {
      text: 'The repository has no AGENTS.md, CLAUDE.md, GEMINI.md, or .github/copilot-instructions.md.',
    },
    help: {
      text: 'Add AGENTS.md with setup commands, validation commands, code style, and safety boundaries.',
    },
  },
  {
    id: 'required-section.setup',
    name: 'Missing setup section',
    shortDescription: { text: 'Missing setup/install commands section.' },
    fullDescription: {
      text: 'Agent instruction file should include a clear setup commands section.',
    },
    help: {
      text: 'Add a concise setup commands section with exact commands and prerequisites.',
    },
  },
  {
    id: 'required-section.test',
    name: 'Missing test section',
    shortDescription: { text: 'Missing test/validation commands section.' },
    fullDescription: {
      text: 'Agent instruction file should include a clear test commands section.',
    },
    help: {
      text: 'Add a concise test commands section with exact commands and validation rules.',
    },
  },
  {
    id: 'required-section.style',
    name: 'Missing code style section',
    shortDescription: { text: 'Missing code style conventions section.' },
    fullDescription: {
      text: 'Agent instruction file should include a clear code style section.',
    },
    help: {
      text: 'Add a concise code style section with exact tools and conventions.',
    },
  },
  {
    id: 'required-section.safety',
    name: 'Missing safety section',
    shortDescription: { text: 'Missing safety boundaries section.' },
    fullDescription: {
      text: 'Agent instruction file should include a clear safety boundaries section.',
    },
    help: {
      text: 'Add a concise safety boundaries section that defines what agents must not do.',
    },
  },
  {
    id: 'required-section.pr',
    name: 'Missing PR section',
    shortDescription: { text: 'Missing PR/review expectations section.' },
    fullDescription: {
      text: 'Agent instruction file should include a clear PR/review expectations section.',
    },
    help: {
      text: 'Add a concise PR/review expectations section that explains review and merge flow.',
    },
  },
  {
    id: 'dangerous-instruction.system-override',
    name: 'System override instruction',
    shortDescription: { text: 'Instruction override language that can behave like prompt injection.' },
    fullDescription: {
      text: 'Instructions telling the agent to ignore previous or above instructions can behave like prompt injection.',
    },
    help: {
      text: 'Replace with a scoped, auditable rule that says when the agent should ask for approval.',
    },
  },
  {
    id: 'dangerous-instruction.skip-tests',
    name: 'Blanket test-skipping instruction',
    shortDescription: { text: 'Blanket test-skipping instruction.' },
    fullDescription: {
      text: 'Agents should normally know when to run or skip tests conditionally, not be told to always skip.',
    },
    help: {
      text: 'Replace with a scoped, auditable rule that says when the agent should ask for approval.',
    },
  },
  {
    id: 'dangerous-instruction.reckless-write',
    name: 'Over-broad write permission',
    shortDescription: { text: 'Over-broad write permission that increases accidental blast radius.' },
    fullDescription: {
      text: 'Instructions telling the agent to edit anything, everything, or all files increase accidental blast radius.',
    },
    help: {
      text: 'Replace with a scoped, auditable rule that says when the agent should ask for approval.',
    },
  },
  {
    id: 'dangerous-instruction.secret-exposure',
    name: 'Secret exposure instruction',
    shortDescription: { text: 'Instruction to print secrets or environment variables.' },
    fullDescription: {
      text: 'Instructions telling the agent to print, show, log, or dump secrets or environment variables must be avoided.',
    },
    help: {
      text: 'Replace with a scoped, auditable rule that says when the agent should ask for approval.',
    },
  },
  {
    id: 'context-bloat.too-long',
    name: 'Instruction file too long',
    shortDescription: { text: 'Instruction file may be too large.' },
    fullDescription: {
      text: 'Long agent instructions increase token cost and can hide conflicts.',
    },
    help: {
      text: 'Move long reference material into docs/ and keep AGENTS.md focused on commands, boundaries, and invariants.',
    },
  },
  {
    id: 'stale-command.missing-package-script',
    name: 'Missing package script',
    shortDescription: { text: 'Referenced npm/pnpm/yarn script does not exist in package.json.' },
    fullDescription: {
      text: 'Instruction references a script that is not defined in package.json, which can confuse agents.',
    },
    help: {
      text: 'Add the missing script to package.json, or update the agent instruction to match existing scripts.',
    },
  },
  {
    id: 'contradictory-rules.duplicate-tool-reference',
    name: 'Competing tool references',
    shortDescription: { text: 'Instruction file references competing tools in the same category.' },
    fullDescription: {
      text: 'The same instruction file mentions 2+ competing tools from the same category (for example ESLint and Biome for linting, or Jest and Vitest for testing). This is a heuristic, regex-based warning, not a semantic analyzer.',
    },
    help: {
      text: 'Pick one preferred tool per category, or clearly document when each tool applies (for example, "use ESLint for app code and Biome only for generated files").',
    },
  },
  {
    id: 'vague-instructions.no-commands',
    name: 'No actionable commands found',
    shortDescription: { text: 'Instruction file contains no concrete commands.' },
    fullDescription: {
      text: 'Agent instruction file contains guidance but no fenced code blocks and no inline command backticks, so agents have no concrete commands to run.',
    },
    help: {
      text: 'Add exact setup and validation commands such as `pnpm install` and `pnpm run ci`, ideally inside fenced code blocks, so agents know exactly what to run.',
    },
  },
];

const METADATA_BY_ID: Map<string, RuleMetadata> = new Map(
  RULE_METADATA.map((rule) => [rule.id, rule]),
);

/**
 * Look up rule metadata by ID. Returns a fallback descriptor for unknown IDs
 * so SARIF consumers always see a valid reportingDescriptor.
 */
export function getRuleMetadata(id: string): RuleMetadata {
  const known = METADATA_BY_ID.get(id);
  if (known) return known;
  return {
    id,
    name: id,
    shortDescription: { text: `Unknown rule: ${id}` },
    fullDescription: {
      text: 'This finding references a rule ID that is not in the current rule metadata catalog.',
    },
    help: {
      text: 'Update the scanner rule metadata catalog to include this rule, or treat this finding as a new rule.',
    },
  };
}
