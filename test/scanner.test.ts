import { describe, expect, it } from 'vitest';
import { scan, resolveFailOn } from '../src/index.js';
import { renderText, renderJson, shouldFail } from '../src/reporters.js';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// ── Scanner core ────────────────────────────────────────────────────────────

describe('scanner', () => {
  it('passes a well-structured AGENTS.md', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'pretty', failOn: 'fail' });
    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
  });

  it('finds dangerous and stale instructions', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    expect(result.findings.map((f) => f.id)).toContain('dangerous-instruction.system-override');
    expect(result.findings.map((f) => f.id)).toContain('dangerous-instruction.skip-tests');
    expect(result.findings.map((f) => f.id)).toContain('stale-command.missing-package-script');
  });

  it('reports missing instruction file when none found', () => {
    const result = scan({ root: 'test/fixtures/empty', format: 'json', failOn: 'fail' });
    expect(result.findings.map((f) => f.id)).toContain('instruction-file.missing');
    expect(result.score).toBeLessThan(100);
  });

  it('detects context bloat in large files', () => {
    const result = scan({ root: 'test/fixtures/bloated', format: 'json', failOn: 'fail' });
    expect(result.findings.map((f) => f.id)).toContain('context-bloat.too-long');
  });

  it('returns scanned instruction file paths', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'pretty', failOn: 'fail' });
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0]).toContain('AGENTS.md');
  });

  it('calculates score correctly — more severe findings reduce more', () => {
    const badResult = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const goodResult = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    expect(goodResult.score).toBeGreaterThan(badResult.score);
  });
});

// ── Required sections rule ──────────────────────────────────────────────────

describe('required-sections rule', () => {
  it('does not warn when all sections are present', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    const sectionFindings = result.findings.filter((f) => f.id.startsWith('required-section'));
    expect(sectionFindings).toHaveLength(0);
  });

  it('warns about missing sections in minimal file', () => {
    const result = scan({ root: 'test/fixtures/minimal', format: 'json', failOn: 'fail' });
    const sectionFindings = result.findings.filter((f) => f.id.startsWith('required-section'));
    expect(sectionFindings.length).toBeGreaterThan(0);
  });
});

// ── Dangerous instructions rule ─────────────────────────────────────────────

describe('dangerous-instructions rule', () => {
  it('detects system-override language', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    expect(result.findings.map((f) => f.id)).toContain('dangerous-instruction.system-override');
  });

  it('detects skip-tests instruction', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    expect(result.findings.map((f) => f.id)).toContain('dangerous-instruction.skip-tests');
  });
});

// ── Stale commands rule ─────────────────────────────────────────────────────

describe('stale-commands rule', () => {
  it('detects "pnpm run <script>" referencing missing scripts', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    expect(result.findings.map((f) => f.id)).toContain('stale-command.missing-package-script');
  });

  it('detects direct commands like "pnpm build", "pnpm lint", "pnpm deploy"', () => {
    const result = scan({ root: 'test/fixtures/stale-direct', format: 'json', failOn: 'fail' });
    const staleFindings = result.findings.filter((f) => f.id === 'stale-command.missing-package-script');
    const staleScripts = staleFindings.map((f) => f.evidence);
    // build, lint, deploy are missing from package.json (only "test" exists)
    expect(staleScripts.some((e) => e?.includes('build'))).toBe(true);
    expect(staleScripts.some((e) => e?.includes('lint'))).toBe(true);
    expect(staleScripts.some((e) => e?.includes('deploy'))).toBe(true);
  });

  it('does not flag "pnpm test" when test script exists', () => {
    const result = scan({ root: 'test/fixtures/stale-direct', format: 'json', failOn: 'fail' });
    const staleFindings = result.findings.filter((f) => f.id === 'stale-command.missing-package-script');
    // "pnpm test" should NOT be flagged — test exists in package.json
    const flaggedTest = staleFindings.filter((f) =>
      f.evidence === 'pnpm test'
    );
    expect(flaggedTest).toHaveLength(0);
  });
});

// ── Reporters ───────────────────────────────────────────────────────────────

describe('reporters', () => {
  it('renderText includes score and findings', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'pretty', failOn: 'fail' });
    const text = renderText(result);
    expect(text).toContain('agents-md-xray score:');
    expect(text).toContain('[FAIL]');
  });

  it('renderJson returns valid JSON with expected fields', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderJson(result));
    expect(parsed.score).toBe(100);
    expect(parsed.findings).toHaveLength(0);
    expect(parsed.root).toBeDefined();
    expect(parsed.files).toBeDefined();
  });

  it('shouldFail returns true when findings match fail level', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    expect(shouldFail(result, 'fail')).toBe(true);
  });

  it('shouldFail returns false for clean repo', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    expect(shouldFail(result, 'fail')).toBe(false);
  });

  it('shouldFail returns false when failOn is off', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    expect(shouldFail(result, 'off')).toBe(false);
  });
});

// ── resolveFailOn ───────────────────────────────────────────────────────────

describe('resolveFailOn', () => {
  it('maps public names correctly', () => {
    expect(resolveFailOn('error')).toBe('fail');
    expect(resolveFailOn('warning')).toBe('warn');
    expect(resolveFailOn('off')).toBe('off');
  });

  it('accepts legacy aliases', () => {
    expect(resolveFailOn('fail')).toBe('fail');
    expect(resolveFailOn('warn')).toBe('warn');
    expect(resolveFailOn('info')).toBe('info');
  });

  it('is case-insensitive', () => {
    expect(resolveFailOn('ERROR')).toBe('fail');
    expect(resolveFailOn('Warning')).toBe('warn');
    expect(resolveFailOn('OFF')).toBe('off');
  });
});

// ── CLI integration ─────────────────────────────────────────────────────────

describe('CLI integration', () => {
  const cliPath = resolve('dist/cli.js');

  function runCli(args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync('node', [cliPath, ...args], {
        encoding: 'utf8',
        cwd: resolve('.'),
      });
      return { stdout, exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; status?: number };
      return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
    }
  }

  it('scan . exits 0 for clean repo (self-scan)', () => {
    const { stdout, exitCode } = runCli(['scan', '.']);
    expect(stdout).toContain('agents-md-xray score:');
    expect(exitCode).toBe(0);
  });

  it('--format json outputs valid JSON', () => {
    const { stdout, exitCode } = runCli(['scan', '.', '--format', 'json']);
    const parsed = JSON.parse(stdout);
    expect(parsed.score).toBeTypeOf('number');
    expect(parsed.findings).toBeInstanceOf(Array);
    expect(exitCode).toBe(0);
  });

  it('--json is an alias for --format json', () => {
    const { stdout, exitCode } = runCli(['scan', '.', '--json']);
    const parsed = JSON.parse(stdout);
    expect(parsed.score).toBeTypeOf('number');
    expect(parsed.findings).toBeInstanceOf(Array);
    expect(exitCode).toBe(0);
  });

  it('--fail-on off never exits 1', () => {
    const { exitCode } = runCli(['scan', 'test/fixtures/bad', '--fail-on', 'off']);
    expect(exitCode).toBe(0);
  });

  it('--fail-on error exits 1 for bad fixture', () => {
    const { exitCode } = runCli(['scan', 'test/fixtures/bad', '--fail-on', 'error']);
    expect(exitCode).toBe(1);
  });

  it('--fail-on warning exits 1 for fixture with warnings', () => {
    const { exitCode } = runCli(['scan', 'test/fixtures/minimal', '--fail-on', 'warning']);
    expect(exitCode).toBe(1);
  });

  it('--help shows usage', () => {
    const { stdout, exitCode } = runCli(['--help']);
    expect(stdout).toContain('--format');
    expect(stdout).toContain('--fail-on');
    expect(stdout).toContain('--json');
    expect(exitCode).toBe(0);
  });
});
