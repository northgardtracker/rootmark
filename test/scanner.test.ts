import { describe, expect, it } from 'vitest';
import { scan, resolveFailOn } from '../src/index.js';
import { renderText, renderJson, renderSarif, shouldFail } from '../src/reporters.js';
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
  it('renderSarif returns valid SARIF with correct version and schema', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs.length).toBeGreaterThan(0);
  });

  it('renderSarif includes tool driver metadata', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe('agents-md-xray');
    expect(driver.informationUri).toBe('https://github.com/northgardtracker/agents-md-xray');
    expect(Array.isArray(driver.rules)).toBe(true);
    expect(driver.rules.length).toBeGreaterThan(0);
  });

  it('renderSarif maps severities correctly', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    const sarifResults = parsed.runs[0].results;
    const failResult = sarifResults.find((r: any) => r.level === 'error');
    const warnResult = sarifResults.find((r: any) => r.level === 'warning');
    expect(failResult || warnResult).toBeDefined();
  });

  it('renderSarif uses repo-relative forward-slash paths', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    const sarifResults = parsed.runs[0].results;
    for (const r of sarifResults) {
      const uri = r.locations[0].physicalLocation.artifactLocation.uri;
      expect(uri).not.toContain('\\');
      expect(uri).not.toContain(':');
    }
  });

  it('renderSarif emits the full rule catalog on clean scans', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    expect(result.findings).toHaveLength(0);
    const parsed = JSON.parse(renderSarif(result));
    const rules = parsed.runs[0].tool.driver.rules;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThanOrEqual(12);
    expect(parsed.runs[0].results).toHaveLength(0);
  });

  it('renderSarif descriptors include all known rule IDs', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    const ruleIds = parsed.runs[0].tool.driver.rules.map((r: { id: string }) => r.id);
    const expectedIds = [
      'instruction-file.missing',
      'required-section.setup',
      'required-section.test',
      'required-section.style',
      'required-section.safety',
      'required-section.pr',
      'dangerous-instruction.system-override',
      'dangerous-instruction.skip-tests',
      'dangerous-instruction.reckless-write',
      'dangerous-instruction.secret-exposure',
      'context-bloat.too-long',
      'stale-command.missing-package-script',
    ];
    for (const id of expectedIds) {
      expect(ruleIds).toContain(id);
    }
  });

  it('renderSarif descriptors include shortDescription, fullDescription, and help', () => {
    const result = scan({ root: 'test/fixtures/good', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    for (const rule of parsed.runs[0].tool.driver.rules) {
      expect(typeof rule.id).toBe('string');
      expect(typeof rule.name).toBe('string');
      expect(rule.shortDescription?.text).toBeTypeOf('string');
      expect(rule.shortDescription.text.length).toBeGreaterThan(0);
      expect(rule.fullDescription?.text).toBeTypeOf('string');
      expect(rule.fullDescription.text.length).toBeGreaterThan(0);
      expect(rule.help?.text).toBeTypeOf('string');
      expect(rule.help.text.length).toBeGreaterThan(0);
    }
  });

  it('renderSarif results still reference matching ruleIds in the catalog', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    const catalogIds = new Set(
      parsed.runs[0].tool.driver.rules.map((r: { id: string }) => r.id),
    );
    for (const r of parsed.runs[0].results) {
      expect(catalogIds.has(r.ruleId)).toBe(true);
    }
  });

  it('renderSarif severity mapping still maps fail->error', () => {
    const result = scan({ root: 'test/fixtures/bad', format: 'json', failOn: 'fail' });
    const parsed = JSON.parse(renderSarif(result));
    const sarifResults = parsed.runs[0].results;
    expect(sarifResults.some((r: { level: string }) => r.level === 'error')).toBe(true);
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

  function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
    try {
      const stdout = execFileSync('node', [cliPath, ...args], {
        encoding: 'utf8',
        cwd: resolve('.'),
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.status ?? 1 };
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

  it('returns exit code 2 for an unreadable root path without a stack trace', () => {
    const { stdout, stderr, exitCode } = runCli(['scan', './definitely-not-existing-path']);
    expect(stdout).toBe('');
    expect(stderr).toContain('Error: cannot read root path: ./definitely-not-existing-path');
    expect(stderr).not.toContain('at ');
    expect(exitCode).toBe(2);
  });
  it('--format sarif outputs valid SARIF JSON', () => {
    const { stdout, exitCode } = runCli(['scan', '.', '--format', 'sarif']);
    const parsed = JSON.parse(stdout);
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(exitCode).toBe(0);
  });

  it('--format sarif still prints results when findings cause exit 1', () => {
    const { stdout, exitCode } = runCli(['scan', 'test/fixtures/bad', '--format', 'sarif', '--fail-on', 'error']);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });

  it('--format sarif with --fail-on off exits 0 even with findings', () => {
    const { stdout, exitCode } = runCli(['scan', 'test/fixtures/bad', '--format', 'sarif', '--fail-on', 'off']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });

  it('unknown --format exits 2', () => {
    const { stderr, exitCode } = runCli(['scan', '.', '--format', 'notreal']);
    expect(stderr).toContain('Unknown format: notreal');
    expect(exitCode).toBe(2);
  });
});
