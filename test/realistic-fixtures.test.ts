import { describe, expect, it } from 'vitest';
import { scan } from '../src/index.js';

/**
 * Tests for synthetic "realistic" instruction file fixtures.
 *
 * These fixtures look like real project instruction files and cover all
 * currently supported instruction-file names and scanner rules. They are
 * checked into the repository under `test/fixtures/realistic-*` and are
 * not discovered by `node dist/cli.js scan .` because the walker skips
 * the `test/` directory.
 */

function ids(result: ReturnType<typeof scan>): string[] {
  return result.findings.map((f) => f.id);
}

// ── Good fixtures: each supported instruction-file name ────────────────────

describe('realistic good AGENTS.md fixture', () => {
  it('has no findings and discovers the file by exact name', () => {
    const result = scan({
      root: 'test/fixtures/realistic-good-agents',
      format: 'json',
      failOn: 'fail'
    });
    expect(result.findings).toHaveLength(0);
    expect(result.files).toContain('AGENTS.md');
  });

  it('passes every required-section rule', () => {
    const result = scan({
      root: 'test/fixtures/realistic-good-agents',
      format: 'json',
      failOn: 'fail'
    });
    const sectionFindings = result.findings.filter((f) => f.id.startsWith('required-section.'));
    expect(sectionFindings).toHaveLength(0);
  });
});

describe('realistic good CLAUDE.md fixture', () => {
  it('has no findings and discovers CLAUDE.md', () => {
    const result = scan({
      root: 'test/fixtures/realistic-good-claude',
      format: 'json',
      failOn: 'fail'
    });
    expect(result.findings).toHaveLength(0);
    expect(result.files).toContain('CLAUDE.md');
  });
});

describe('realistic good GEMINI.md fixture', () => {
  it('has no findings and discovers GEMINI.md', () => {
    const result = scan({
      root: 'test/fixtures/realistic-good-gemini',
      format: 'json',
      failOn: 'fail'
    });
    expect(result.findings).toHaveLength(0);
    expect(result.files).toContain('GEMINI.md');
  });
});

describe('realistic good .github/copilot-instructions.md fixture', () => {
  it('has no findings and discovers the nested copilot instructions', () => {
    const result = scan({
      root: 'test/fixtures/realistic-good-copilot',
      format: 'json',
      failOn: 'fail'
    });
    expect(result.findings).toHaveLength(0);
    expect(result.files).toContain('.github/copilot-instructions.md');
  });
});

// ── Bad fixtures: each scanner rule category ───────────────────────────────

describe('realistic bad dangerous fixture', () => {
  it('triggers all four dangerous-instruction rules', () => {
    const result = scan({
      root: 'test/fixtures/realistic-bad-dangerous',
      format: 'json',
      failOn: 'fail',
      strict: true,
    });
    const found = ids(result);
    expect(found).toContain('dangerous-instruction.system-override');
    expect(found).toContain('dangerous-instruction.skip-tests');
    expect(found).toContain('dangerous-instruction.reckless-write');
    expect(found).toContain('dangerous-instruction.secret-exposure');
  });

  it('records a non-empty evidence snippet for each dangerous rule', () => {
    const result = scan({
      root: 'test/fixtures/realistic-bad-dangerous',
      format: 'json',
      failOn: 'fail',
      strict: true,
    });
    const dangerous = result.findings.filter((f) => f.id.startsWith('dangerous-instruction.'));
    for (const finding of dangerous) {
      expect(finding.evidence).toBeTruthy();
    }
  });
});

describe('realistic bad stale-command fixture', () => {
  it('flags each referenced script that is missing from package.json', () => {
    const result = scan({
      root: 'test/fixtures/realistic-bad-stale',
      format: 'json',
      failOn: 'fail'
    });
    const staleFindings = result.findings.filter((f) => f.id === 'stale-command.missing-package-script');
    const staleScripts = staleFindings.map((f) => f.evidence ?? '');

    expect(staleScripts.some((e) => e.includes('e2e'))).toBe(true);
    expect(staleScripts.some((e) => e.includes('load'))).toBe(true);
    expect(staleScripts.some((e) => e.includes('mutate'))).toBe(true);
    expect(staleScripts.some((e) => e.includes('deploy'))).toBe(true);
    expect(staleScripts.some((e) => e.includes('smoke'))).toBe(true);
  });

  it('does not flag scripts that exist in package.json', () => {
    const result = scan({
      root: 'test/fixtures/realistic-bad-stale',
      format: 'json',
      failOn: 'fail'
    });
    const staleFindings = result.findings.filter((f) => f.id === 'stale-command.missing-package-script');
    const flaggedTest = staleFindings.filter((f) => f.evidence === 'pnpm test');
    expect(flaggedTest).toHaveLength(0);
  });
});

describe('realistic bad missing-sections fixture', () => {
  it('flags every required section that the fixture leaves out', () => {
    const result = scan({
      root: 'test/fixtures/realistic-bad-missing-sections',
      format: 'json',
      failOn: 'fail',
      strict: true,
    });
    const sectionFindings = ids(result).filter((id) => id.startsWith('required-section.'));
    expect(sectionFindings).toContain('required-section.style');
    expect(sectionFindings).toContain('required-section.safety');
    expect(sectionFindings).toContain('required-section.pr');
  });
});

describe('realistic bad bloated fixture', () => {
  it('triggers context-bloat.too-long', () => {
    const result = scan({
      root: 'test/fixtures/realistic-bad-bloated',
      format: 'json',
      failOn: 'fail',
      strict: true,
    });
    expect(ids(result)).toContain('context-bloat.too-long');
  });
});
