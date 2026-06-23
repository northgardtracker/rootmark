#!/usr/bin/env node
import { accessSync, constants, statSync } from "node:fs";
import { resolve } from "node:path";
import { scan } from "./scanner.js";
import {
  renderJson,
  renderSarif,
  renderText,
  shouldFail,
} from "./reporters.js";
import { resolveFailOn } from "./types.js";
import type { Severity } from "./types.js";

function main(argv: string[]): number {
  const command = argv[2] ?? "verify";
  if (command === "--help" || command === "-h" || command === "--version") {
    if (command === "--version") {
      console.log("0.1.4");
      return 0;
    }
    printHelp();
    return 0;
  }
  if (command !== "verify") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 2;
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }

  const rootArg = argv.find(
    (a) =>
      !a.startsWith("-") && a !== "verify" && a !== argv[0] && a !== argv[1],
  );
  const rootInput = rootArg ?? ".";
  const root = resolve(rootInput);

  const rootError = getRootPathError(root, rootInput);
  if (rootError) {
    console.error(`Error: ${rootError}`);
    return 2;
  }

  // --format pretty|json|sarif (default: pretty)
  const formatFlag = getFlagValue(argv, "--format");
  const hasJsonAlias = argv.includes("--json");
  let format: "pretty" | "json" | "sarif" = "pretty";
  if (hasJsonAlias) {
    format = "json";
  } else if (formatFlag) {
    if (formatFlag === "json") {
      format = "json";
    } else if (formatFlag === "pretty") {
      format = "pretty";
    } else if (formatFlag === "sarif") {
      format = "sarif";
    } else {
      console.error(
        `Unknown format: ${formatFlag}. Valid formats: pretty, json, sarif`,
      );
      return 2;
    }
  }

  // --fail-on warning|error|off (legacy: fail|warn|info)
  // Default is `off` (report-only) so a clean or finding-bearing scan never
  // fails CI unless the user explicitly opts in via --fail-on warning|error.
  const failOnRaw = getFlagValue(argv, "--fail-on") ?? "off";
  const failOn = resolveFailOn(failOnRaw);

  try {
    const result = scan({
      root,
      format,
      failOn: failOn === "off" ? "fail" : failOn,
    });
    console.log(
      format === "json"
        ? renderJson(result)
        : format === "sarif"
          ? renderSarif(result)
          : renderText(result),
    );
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

function getRootPathError(
  root: string,
  displayPath: string,
): string | undefined {
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
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return (
    code === "ENOENT" ||
    code === "EACCES" ||
    code === "EPERM" ||
    code === "ENOTDIR"
  );
}

function printHelp(): void {
  console.log(`rootmark — Grounded verification for AGENTS.md and AI-agent instructions

Usage:
  rootmark verify [root] [options]

Options:
  --format <pretty|json|sarif>   Output format (default: pretty)
  --json                         Alias for --format json
  --fail-on <warning|error|off>  Exit 1 when findings match this level (default: off)
  --help, -h                     Show this help
  --version                      Show version

Examples:
  rootmark verify .
  rootmark verify . --format json
  rootmark verify . --json
  rootmark verify . --format sarif
  rootmark verify . --fail-on warning
  rootmark verify . --fail-on off
`);
}

process.exitCode = main(process.argv);
