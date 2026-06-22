#!/usr/bin/env node
import { accessSync, constants, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { scan } from './scanner.js';
import { renderJson, renderSarif, renderText, shouldFail } from './reporters.js';
import { resolveFailOn } from './types.js';
import type { Severity } from './types.js';

function main(argv: string[]): number {
  const command = argv[2] ?? 'scan';
  if (command === '--help' || command === '-h' || command === '--version') {
    if (command === '--version') {
      console.log('0.1.3');
      return 0;
    }
    printHelp();
    return 0;
  }
  if (command !== 'scan') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 2;
  }

  const rootArg = argv.find((a) => !a.startsWith('-') && a !== 'scan' && a !== argv[0] && a !== argv[1]);
  const rootInput = rootArg ?? '.';
  const root = resolve(rootInput);

  const rootError = getRootPathError(root, rootInput);
  if (rootError) {
    console.error(`Error: ${rootError}`);
    return 2;
  }

  // --format pretty|json|sarif (default: pretty)
  const formatFlag = getFlagValue(argv, '--format');
  const hasJsonAlias = argv.includes('--json');
  let format: 'pretty' | 'json' | 'sarif' = 'pretty';
  if (hasJsonAlias) {
    format = 'json';
  } else if (formatFlag) {
    if (formatFlag === 'json') {
      format = 'json';
    } else if (formatFlag === 'pretty') {
      format = 'pretty';
    } else if (formatFlag === 'sarif') {
      format = 'sarif';
    } else {
      console.error(`Unknown format: ${formatFlag}. Valid formats: pretty, json, sarif`);
      return 2;
    }
  }

  // --fail-on warning|error|off (legacy: fail|warn|info)
  const failOnRaw = getFlagValue(argv, '--fail-on') ?? 'error';
  const failOn = resolveFailOn(failOnRaw);

  try {
    const result = scan({ root, format, failOn: failOn === 'off' ? 'fail' : failOn });
    console.log(format === 'json' ? renderJson(result) : format === 'sarif' ? renderSarif(result) : renderText(result));
    return shouldFail(result, failOn) ? 1 : 0;
  } catch (error) {
    if (isPathAccessError(error)) {
      console.error(`Error: cannot read root path: ${rootInput}`);
      return 2;
    }
    throw error;
  }
}

function getFlagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function getRootPathError(root: string, displayPath: string): string | undefined {
  try {
    const stats = statSync(root);
    if (!stats.isDirectory()) {
      return `cannot read root path: ${displayPath}`;
    }
    accessSync(root, constants.R_OK | constants.X_OK);
    return undefined;
  } catch {
    return `cannot read root path: ${displayPath}`;
  }
}

function isPathAccessError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'ENOENT' || code === 'EACCES' || code === 'EPERM' || code === 'ENOTDIR';
}

function printHelp(): void {
  console.log(`agents-md-xray — X-ray for AGENTS.md and coding-agent instruction drift

Usage:
  agents-md-xray scan [root] [options]

Options:
  --format <pretty|json|sarif>   Output format (default: pretty)
  --json                         Alias for --format json
  --fail-on <warning|error|off>  Exit 1 when findings match this level (default: error)
  --help, -h                     Show this help
  --version                      Show version

Examples:
  agents-md-xray scan .
  agents-md-xray scan . --format json
  agents-md-xray scan . --json
  agents-md-xray scan . --format sarif
  agents-md-xray scan . --fail-on warning
  agents-md-xray scan . --fail-on off
`);
}

process.exitCode = main(process.argv);
