import type { Finding } from '../types.js';

// Matches both "run" style and direct shorthand commands:
//   pnpm run lint        → script = "lint"
//   pnpm test            → script = "test"
//   npm run build        → script = "build"
//   yarn test            → script = "test"
//   npm test             → script = "test"
const SCRIPT_RUN_RE = /\b(?:npm|pnpm|yarn)\s+run\s+([a-zA-Z0-9:_-]+)/g;
const SCRIPT_DIRECT_RE = /\b(?:npm|pnpm|yarn)\s+(?!run\b|install\b|add\b|remove\b|uninstall\b|init\b|create\b|publish\b|pack\b|link\b|exec\b|dlx\b|why\b|outdated\b|update\b|upgrade\b|audit\b|dedupe\b|prune\b|rebuild\b|cache\b|config\b|set\b|get\b|info\b|view\b|search\b|login\b|logout\b|whoami\b|token\b|team\b|access\b|owner\b|deprecate\b|dist-tag\b|version\b|shrinkwrap\b|help\b|bin\b|bugs\b|ci\b|completion\b|doctor\b|explore\b|fund\b|hook\b|ls\b|list\b|prefix\b|profile\b|root\b|star\b|stars\b|unstar\b|ping\b|repo\b|explain\b|setup\b|store\b|patch\b|approve-builds\b|i\b|--)([a-zA-Z][a-zA-Z0-9:_-]*)/g;

export function staleCommands(file: string, text: string, packageScripts: Set<string>): Finding[] {
  if (packageScripts.size === 0) return [];
  const findings: Finding[] = [];
  const seen = new Set<string>();

  // Match "npm/pnpm/yarn run <script>"
  for (const match of text.matchAll(SCRIPT_RUN_RE)) {
    const script = match[1];
    const key = `${script}@${match.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!packageScripts.has(script)) {
      findings.push(makeFinding(file, script, match[0]));
    }
  }

  // Match direct commands: "pnpm test", "pnpm build", "npm test", etc.
  for (const match of text.matchAll(SCRIPT_DIRECT_RE)) {
    const script = match[1];
    const key = `${script}@${match.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!packageScripts.has(script)) {
      findings.push(makeFinding(file, script, match[0]));
    }
  }

  return findings;
}

function makeFinding(file: string, script: string, evidence: string): Finding {
  return {
    id: 'stale-command.missing-package-script',
    severity: 'fail',
    title: 'Referenced npm script does not exist',
    message: `Instruction references script "${script}", but package.json does not define it.`,
    file,
    evidence,
    remediation: `Add "${script}" to package.json scripts, or update the agent instruction.`
  };
}
