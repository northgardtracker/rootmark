import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('package metadata', () => {
  it('has repository URL matching the GitHub repo for npm provenance', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    expect(pkg.repository).toBeDefined();
    expect(pkg.repository.type).toBe('git');
    expect(pkg.repository.url).toBe('https://github.com/northgardtracker/agents-md-xray');
  });
});
