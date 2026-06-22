#!/usr/bin/env node
import { resolve } from 'node:path';
import { scan } from './scanner.js';
import { renderJson, renderText, shouldFail } from './reporters.js';
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
  const root = resolve(rootArg ?? process.cwd());

  // --format pretty|json (default: pretty)
  const formatFlag = getFlagValue(argv, '--format');
  const hasJsonAlias = argv.includes('--json');
  let format: 'pretty' | 'json' = 'pretty';
  if (hasJsonAlias) {
    format = 'json';
  } else if (formatFlag) {
    if (formatFlag === 'json') {
      format = 'json';
    } else if (formatFlag === 'pretty') {
      format = 'pretty';
    } else {
      console.error(`Unknown format: ${formatFlag}. Valid formats: pretty, json`);
      return 2;
    }
  }

  // --fail-on warning|error|off (legacy: fail|warn|info)
  const failOnRaw = getFlagValue(argv, '--fail-on') ?? 'error';
  const failOn = resolveFailOn(failOnRaw);

  const result = scan({ root, format, failOn: failOn === 'off' ? 'fail' : failOn });
  console.log(format === 'json' ? renderJson(result) : renderText(result));
  return shouldFail(result, failOn) ? 1 : 0;
}

function getFlagValue(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function printHelp(): void {
  console.log(`agents-md-xray — X-ray for AGENTS.md and coding-agent instruction drift

Usage:
  agents-md-xray scan [root] [options]

Options:
  --format <pretty|json>         Output format (default: pretty)
  --json                         Alias for --format json
  --fail-on <warning|error|off>  Exit 1 when findings match this level (default: error)
  --help, -h                     Show this help
  --version                      Show version

Examples:
  agents-md-xray scan .
  agents-md-xray scan . --format json
  agents-md-xray scan . --json
  agents-md-xray scan . --fail-on warning
  agents-md-xray scan . --fail-on off
`);
}

process.exitCode = main(process.argv);
