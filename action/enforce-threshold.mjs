// Composite-action step: enforce the requested `fail-on` threshold using the
// scan JSON. This runs AFTER the optional comment step so a PR summary is
// posted even when the job is about to fail. Built-in modules only.
import { readFileSync } from 'node:fs';
import { evaluateThreshold } from './lib.mjs';

function fail(message) {
  console.log(`::error title=agents-md-xray::${message}`);
  process.exit(1);
}

const resultsPath = process.env.RESULTS_JSON;
const failOn = process.env.FAIL_ON ?? 'error';
if (!resultsPath) fail('RESULTS_JSON is not set.');

let result;
try {
  result = JSON.parse(readFileSync(resultsPath, 'utf8'));
} catch (error) {
  fail(`could not read scan results from ${resultsPath}: ${error?.message ?? error}`);
}

const findings = Array.isArray(result.findings) ? result.findings : [];

let outcome;
try {
  outcome = evaluateThreshold(findings, failOn);
} catch (error) {
  // Invalid fail-on value: surface a clear configuration error.
  fail(error?.message ?? String(error));
}

if (outcome.shouldFail) {
  fail(`findings meet the "${failOn}" failure threshold (${findings.length} finding(s)).`);
}

console.log(`agents-md-xray: ${findings.length} finding(s) do not meet the "${failOn}" failure threshold.`);
