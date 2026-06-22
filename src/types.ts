export type Severity = 'info' | 'warn' | 'fail';

/** Public CLI severity names and their internal mapping. */
export type PublicSeverity = 'off' | 'warning' | 'error';

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  message: string;
  file?: string;
  evidence?: string;
  remediation?: string;
}

export interface ScanOptions {
  root: string;
  format: 'pretty' | 'json' | 'sarif';
  failOn: Severity;
}

export interface ScanResult {
  root: string;
  score: number;
  files: string[];
  findings: Finding[];
}

/**
 * Resolve a public severity name (or legacy alias) to an internal Severity.
 * Returns undefined for 'off' (meaning never fail).
 */
export function resolveFailOn(value: string): Severity | 'off' {
  const v = value.toLowerCase();
  // Public names
  if (v === 'off') return 'off';
  if (v === 'warning') return 'warn';
  if (v === 'error') return 'fail';
  // Legacy aliases
  if (v === 'fail') return 'fail';
  if (v === 'warn') return 'warn';
  if (v === 'info') return 'info';
  // Default
  return 'fail';
}

// Re-export for reporter helpers
export { }
