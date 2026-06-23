// Composite-action step: read the scan JSON and publish the action output
// `findings-count`. The `json-path` output is set directly by the
// scan shell step. Built-in modules only.
import { appendFileSync, readFileSync } from "node:fs";
import { summarize } from "./lib.mjs";

function fail(message) {
  console.log(`::error title=Rootmark::${message}`);
  process.exit(1);
}

const resultsPath = process.env.RESULTS_JSON;
if (!resultsPath) fail("RESULTS_JSON is not set.");

let result;
try {
  result = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch (error) {
  fail(
    `could not read scan results from ${resultsPath}: ${error?.message ?? error}`,
  );
}

const { findingsCount } = summarize(result);

const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  appendFileSync(
    outputPath,
    `findings-count=${findingsCount}\n`,
  );
}

console.log(`rootmark: findings=${findingsCount}`);
