import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage', 'test', 'tests', '__tests__']);
const INSTRUCTION_FILE_NAMES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'copilot-instructions.md'
]);

export function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

export function findInstructionFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, (path, name) => {
    if (INSTRUCTION_FILE_NAMES.has(name) || path.endsWith(join('.github', 'copilot-instructions.md'))) {
      out.push(path);
    }
  });
  return out.sort((a, b) => a.localeCompare(b));
}

export function findPackageJson(root: string): string | undefined {
  const p = join(root, 'package.json');
  return existsSync(p) ? p : undefined;
}

export function loadPackageScripts(root: string): Set<string> {
  const pkg = findPackageJson(root);
  if (!pkg) return new Set();
  try {
    const parsed = JSON.parse(readText(pkg)) as { scripts?: Record<string, string> };
    return new Set(Object.keys(parsed.scripts ?? {}));
  } catch {
    return new Set();
  }
}

export function rel(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/');
}

function walk(dir: string, onFile: (path: string, name: string) => void): void {
  for (const entry of readdirSync(dir)) {
    if (IGNORED.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, onFile);
    if (st.isFile()) onFile(full, entry);
  }
}
