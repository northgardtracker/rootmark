import { describe, expect, it } from "vitest";
import { scan, resolveFailOn } from "../src/index.js";
import {
  renderText,
  renderJson,
  renderSarif,
  shouldFail,
} from "../src/reporters.js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Scanner core ────────────────────────────────────────────────────────────

describe("scanner", () => {
  it("passes a well-structured AGENTS.md", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "pretty",
      failOn: "fail",
    });
    expect(result.findings).toHaveLength(0);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("finds dangerous and stale instructions", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings.map((f) => f.id)).toContain(
      "dangerous-instruction.system-override",
    );
    expect(result.findings.map((f) => f.id)).toContain(
      "dangerous-instruction.skip-tests",
    );
    expect(result.findings.map((f) => f.id)).toContain(
      "stale-command.missing-package-script",
    );
  });

  it("reports missing instruction file when none found", () => {
    const result = scan({
      root: "test/fixtures/empty",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings.map((f) => f.id)).toContain(
      "instruction-file.missing",
    );
  });

  it("detects context bloat in large files", () => {
    const result = scan({
      root: "test/fixtures/bloated",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings.map((f) => f.id)).toContain(
      "context-bloat.too-long",
    );
  });

  it("returns scanned instruction file paths", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "pretty",
      failOn: "fail",
    });
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0]).toContain("AGENTS.md");
  });

});

// ── Required sections rule ──────────────────────────────────────────────────

describe("required-sections rule", () => {
  it("does not warn when all sections are present", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    const sectionFindings = result.findings.filter((f) =>
      f.id.startsWith("required-section"),
    );
    expect(sectionFindings).toHaveLength(0);
  });

  it("warns about missing sections in minimal file", () => {
    const result = scan({
      root: "test/fixtures/minimal",
      format: "json",
      failOn: "fail",
    });
    const sectionFindings = result.findings.filter((f) =>
      f.id.startsWith("required-section"),
    );
    expect(sectionFindings.length).toBeGreaterThan(0);
  });
});

// ── Dangerous instructions rule ─────────────────────────────────────────────

describe("dangerous-instructions rule", () => {
  it("detects system-override language", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings.map((f) => f.id)).toContain(
      "dangerous-instruction.system-override",
    );
  });

  it("detects skip-tests instruction", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings.map((f) => f.id)).toContain(
      "dangerous-instruction.skip-tests",
    );
  });
});

// ── Stale commands rule ─────────────────────────────────────────────────────

describe("stale-commands rule", () => {
  it('detects "pnpm run <script>" referencing missing scripts', () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings.map((f) => f.id)).toContain(
      "stale-command.missing-package-script",
    );
  });

  it('detects direct commands like "pnpm build", "pnpm lint", "pnpm deploy"', () => {
    const result = scan({
      root: "test/fixtures/stale-direct",
      format: "json",
      failOn: "fail",
    });
    const staleFindings = result.findings.filter(
      (f) => f.id === "stale-command.missing-package-script",
    );
    const staleScripts = staleFindings.map((f) => f.evidence);
    // build, lint, deploy are missing from package.json (only "test" exists)
    expect(staleScripts.some((e) => e?.includes("build"))).toBe(true);
    expect(staleScripts.some((e) => e?.includes("lint"))).toBe(true);
    expect(staleScripts.some((e) => e?.includes("deploy"))).toBe(true);
  });

  it('does not flag "pnpm test" when test script exists', () => {
    const result = scan({
      root: "test/fixtures/stale-direct",
      format: "json",
      failOn: "fail",
    });
    const staleFindings = result.findings.filter(
      (f) => f.id === "stale-command.missing-package-script",
    );
    // "pnpm test" should NOT be flagged — test exists in package.json
    const flaggedTest = staleFindings.filter((f) => f.evidence === "pnpm test");
    expect(flaggedTest).toHaveLength(0);
  });
});

// ── Vague instructions rule ─────────────────────────────────────────────────

describe("vague-instructions rule", () => {
  it("flags an instruction file with prose but no actionable commands", () => {
    const result = scan({
      root: "test/fixtures/vague-no-commands",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "vague-instructions.no-commands",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("warn");
    expect(findings[0].file).toBe("AGENTS.md");
    expect(findings[0].remediation).toBeTruthy();
  });

  it("does not flag a file that has at least one inline command backtick", () => {
    const result = scan({
      root: "test/fixtures/actionable-inline-command",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "vague-instructions.no-commands",
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag a file that has at least one fenced code block", () => {
    const result = scan({
      root: "test/fixtures/actionable-code-block",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "vague-instructions.no-commands",
    );
    expect(findings).toHaveLength(0);
  });

  it("still flags a file whose only backticks wrap non-command identifiers", () => {
    const result = scan({
      root: "test/fixtures/backtick-identifiers-only",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "vague-instructions.no-commands",
    );
    expect(findings).toHaveLength(1);
  });

  it("does not flag the well-structured good fixture", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "vague-instructions.no-commands",
    );
    expect(findings).toHaveLength(0);
  });
});
// ── Contradictory tool references rule ──────────────────────────────────────

describe("contradictory-rules rule", () => {
  it("flags competing lint/format tools", () => {
    const result = scan({
      root: "test/fixtures/contradictory-lint-tools",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "contradictory-rules.duplicate-tool-reference",
    );
    const lintFinding = findings.find((f) => f.evidence?.startsWith("lint:"));
    expect(lintFinding).toBeDefined();
    expect(lintFinding?.evidence).toContain("eslint");
    expect(lintFinding?.evidence).toContain("biome");
    expect(lintFinding?.severity).toBe("warn");
    expect(lintFinding?.file).toBe("AGENTS.md");
  });

  it("flags competing JS/TS test tools", () => {
    const result = scan({
      root: "test/fixtures/contradictory-test-tools",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "contradictory-rules.duplicate-tool-reference",
    );
    const testFinding = findings.find((f) => f.evidence?.startsWith("test:"));
    expect(testFinding).toBeDefined();
    expect(testFinding?.evidence).toContain("jest");
    expect(testFinding?.evidence).toContain("vitest");
  });

  it("flags competing package managers", () => {
    const result = scan({
      root: "test/fixtures/contradictory-package-managers",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "contradictory-rules.duplicate-tool-reference",
    );
    const pmFinding = findings.find((f) =>
      f.evidence?.startsWith("package-manager:"),
    );
    expect(pmFinding).toBeDefined();
    expect(pmFinding?.evidence).toContain("npm");
    expect(pmFinding?.evidence).toContain("pnpm");
  });

  it("does not flag a fixture with one tool per category", () => {
    const result = scan({
      root: "test/fixtures/non-contradictory-single-tool",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "contradictory-rules.duplicate-tool-reference",
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag the well-structured good fixture", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "contradictory-rules.duplicate-tool-reference",
    );
    expect(findings).toHaveLength(0);
  });

  it("produces deterministic sorted evidence", () => {
    const result = scan({
      root: "test/fixtures/contradictory-lint-tools",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "contradictory-rules.duplicate-tool-reference",
    );
    const lintFinding = findings.find((f) => f.evidence?.startsWith("lint:"));
    expect(lintFinding?.evidence).toMatch(/^lint: [a-z, ]+$/);
  });
});
it("does not flag a clearly scoped boundary between competing tools", () => {
  const result = scan({
    root: "test/fixtures/non-contradictory-scoped-tools",
    format: "json",
    failOn: "fail",
  });
  const findings = result.findings.filter(
    (f) => f.id === "contradictory-rules.duplicate-tool-reference",
  );
  expect(findings).toHaveLength(0);
});

it("does not flag a hyphenated tool name like run-ava-tests near another test tool", () => {
  const result = scan({
    root: "test/fixtures/non-contradictory-hyphenated-tool-name",
    format: "json",
    failOn: "fail",
  });
  const findings = result.findings.filter(
    (f) => f.id === "contradictory-rules.duplicate-tool-reference",
  );
  expect(findings).toHaveLength(0);
});

// ── Nested instruction conflicts rule ───────────────────────────────────────

describe("nested-conflicts rule", () => {
  it("flags a parent/child lint-tool conflict", () => {
    const result = scan({
      root: "test/fixtures/nested-conflict-tools",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.contradictory-tools",
    );
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const f = findings[0];
    expect(f.severity).toBe("warn");
    expect(f.file).toBe("packages/api/AGENTS.md");
    expect(f.evidence).toContain("lint:");
    expect(f.evidence).toContain("AGENTS.md -> packages/api/AGENTS.md");
  });

  it("flags a parent/child test-tool conflict", () => {
    const result = scan({
      root: "test/fixtures/nested-conflict-test-tools",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.contradictory-tools",
    );
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const f = findings[0];
    expect(f.evidence).toContain("test:");
    expect(f.evidence).toContain("jest");
    expect(f.evidence).toContain("vitest");
  });

  it("does not flag a scoped child override that uses only", () => {
    const result = scan({
      root: "test/fixtures/nested-no-conflict-scoped-override",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.contradictory-tools",
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag a parent/child pair that uses the same tools", () => {
    const result = scan({
      root: "test/fixtures/nested-no-conflict-same-tool",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.contradictory-tools",
    );
    expect(findings).toHaveLength(0);
  });

  it("flags a missing override when broad parent guidance has no local package file", () => {
    const result = scan({
      root: "test/fixtures/nested-missing-override",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.missing-override",
    );
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const f = findings[0];
    expect(f.severity).toBe("warn");
    expect(f.file).toBe("AGENTS.md");
    expect(f.evidence).toContain("packages/api");
    expect(f.evidence).toContain("package.json");
  });

  it("does not flag missing override when the package already has a local AGENTS.md", () => {
    const result = scan({
      root: "test/fixtures/nested-has-local-override",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.missing-override",
    );
    expect(findings).toHaveLength(0);
  });

  it("does not flag missing override when the nearest ancestor is not broad (regression)", () => {
    // Root has broad wording, but packages/AGENTS.md (the NEAREST ancestor
    // of packages/api) does NOT. The rule must use the nearest ancestor,
    // not the most distant one (root).
    const result = scan({
      root: "test/fixtures/nested-nearest-ancestor-missing-override",
      format: "json",
      failOn: "fail",
    });
    const findings = result.findings.filter(
      (f) => f.id === "nested-conflict.missing-override",
    );
    expect(findings).toHaveLength(0);
  });
});
// ── Reporters ───────────────────────────────────────────────────────────────

describe("reporters", () => {
  it("renderText includes the findings header and per-finding output", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "pretty",
      failOn: "fail",
    });
    const text = renderText(result);
    expect(text).toContain("Rootmark ");
    expect(text).toContain("finding(s)");
    expect(text).toContain("[FAIL]");
    // PR1 anti-regression: score line must never come back.
    expect(text).not.toContain("rootmark score:");
  });

  it("renderJson returns valid JSON with expected fields", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderJson(result));
    expect(parsed.findings).toHaveLength(0);
    expect(parsed.root).toBeDefined();
    expect(parsed.files).toBeDefined();
    // PR2: score is gone from ScanResult and from the JSON output.
    expect(parsed.score).toBeUndefined();
  });

  it("shouldFail returns true when findings match fail level", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    expect(shouldFail(result, "fail")).toBe(true);
  });

  it("shouldFail returns false for clean repo", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    expect(shouldFail(result, "fail")).toBe(false);
  });

  it("shouldFail returns false when failOn is off", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    expect(shouldFail(result, "off")).toBe(false);
  });
  it("renderSarif returns valid SARIF with correct version and schema", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toBe(
      "https://json.schemastore.org/sarif-2.1.0.json",
    );
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs.length).toBeGreaterThan(0);
  });

  it("renderSarif includes tool driver metadata", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe("rootmark");
    expect(driver.informationUri).toBe(
      "https://github.com/northgardtracker/rootmark",
    );
    expect(Array.isArray(driver.rules)).toBe(true);
    expect(driver.rules.length).toBeGreaterThan(0);
  });

  it("renderSarif maps severities correctly", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    const sarifResults = parsed.runs[0].results;
    const failResult = sarifResults.find((r: any) => r.level === "error");
    const warnResult = sarifResults.find((r: any) => r.level === "warning");
    expect(failResult || warnResult).toBeDefined();
  });

  it("renderSarif uses repo-relative forward-slash paths", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    const sarifResults = parsed.runs[0].results;
    for (const r of sarifResults) {
      const uri = r.locations[0].physicalLocation.artifactLocation.uri;
      expect(uri).not.toContain("\\");
      expect(uri).not.toContain(":");
    }
  });

  it("renderSarif emits the full rule catalog on clean scans", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    expect(result.findings).toHaveLength(0);
    const parsed = JSON.parse(renderSarif(result));
    const rules = parsed.runs[0].tool.driver.rules;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThanOrEqual(16);
    expect(parsed.runs[0].results).toHaveLength(0);
  });

  it("renderSarif descriptors include all known rule IDs", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    const ruleIds = parsed.runs[0].tool.driver.rules.map(
      (r: { id: string }) => r.id,
    );
    const expectedIds = [
      "instruction-file.missing",
      "required-section.setup",
      "required-section.test",
      "required-section.style",
      "required-section.safety",
      "required-section.pr",
      "dangerous-instruction.system-override",
      "dangerous-instruction.skip-tests",
      "dangerous-instruction.reckless-write",
      "dangerous-instruction.secret-exposure",
      "context-bloat.too-long",
      "stale-command.missing-package-script",
      "vague-instructions.no-commands",
      "contradictory-rules.duplicate-tool-reference",
      "nested-conflict.contradictory-tools",
      "nested-conflict.missing-override",
    ];
    for (const id of expectedIds) {
      expect(ruleIds).toContain(id);
    }
  });

  it("renderSarif descriptors include shortDescription, fullDescription, and help", () => {
    const result = scan({
      root: "test/fixtures/good",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    for (const rule of parsed.runs[0].tool.driver.rules) {
      expect(typeof rule.id).toBe("string");
      expect(typeof rule.name).toBe("string");
      expect(rule.shortDescription?.text).toBeTypeOf("string");
      expect(rule.shortDescription.text.length).toBeGreaterThan(0);
      expect(rule.fullDescription?.text).toBeTypeOf("string");
      expect(rule.fullDescription.text.length).toBeGreaterThan(0);
      expect(rule.help?.text).toBeTypeOf("string");
      expect(rule.help.text.length).toBeGreaterThan(0);
    }
  });

  it("renderSarif results still reference matching ruleIds in the catalog", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    const catalogIds = new Set(
      parsed.runs[0].tool.driver.rules.map((r: { id: string }) => r.id),
    );
    for (const r of parsed.runs[0].results) {
      expect(catalogIds.has(r.ruleId)).toBe(true);
    }
  });

  it("renderSarif severity mapping still maps fail->error", () => {
    const result = scan({
      root: "test/fixtures/bad",
      format: "json",
      failOn: "fail",
    });
    const parsed = JSON.parse(renderSarif(result));
    const sarifResults = parsed.runs[0].results;
    expect(
      sarifResults.some((r: { level: string }) => r.level === "error"),
    ).toBe(true);
  });
});

// ── resolveFailOn ───────────────────────────────────────────────────────────

describe("resolveFailOn", () => {
  it("maps public names correctly", () => {
    expect(resolveFailOn("error")).toBe("fail");
    expect(resolveFailOn("warning")).toBe("warn");
    expect(resolveFailOn("off")).toBe("off");
  });

  it("accepts legacy aliases", () => {
    expect(resolveFailOn("fail")).toBe("fail");
    expect(resolveFailOn("warn")).toBe("warn");
    expect(resolveFailOn("info")).toBe("info");
  });

  it("is case-insensitive", () => {
    expect(resolveFailOn("ERROR")).toBe("fail");
    expect(resolveFailOn("Warning")).toBe("warn");
    expect(resolveFailOn("OFF")).toBe("off");
  });
});

// ── CLI integration ─────────────────────────────────────────────────────────

describe("CLI integration", () => {
  const cliPath = resolve("dist/cli.js");

  function runCli(args: string[]): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    try {
      const stdout = execFileSync("node", [cliPath, ...args], {
        encoding: "utf8",
        cwd: resolve("."),
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        exitCode: e.status ?? 1,
      };
    }
  }

  it("verify . exits 0 for clean repo (self-scan)", () => {
    const { stdout, exitCode } = runCli(["verify", "."]);
    expect(stdout).toContain("Rootmark ");
    expect(stdout).toContain("finding(s)");
    expect(stdout).toContain("No findings.");
    // PR2: score line is gone for good.
    expect(stdout).not.toContain("rootmark score:");
    expect(exitCode).toBe(0);
  });

  it("--format json outputs valid JSON", () => {
    const { stdout, exitCode } = runCli(["verify", ".", "--format", "json"]);
    const parsed = JSON.parse(stdout);
    expect(parsed.findings).toBeInstanceOf(Array);
    expect(parsed.root).toBeDefined();
    expect(parsed.files).toBeDefined();
    // PR2: score is gone from the JSON shape.
    expect(parsed.score).toBeUndefined();
    expect(exitCode).toBe(0);
  });

  it("--json is an alias for --format json", () => {
    const { stdout, exitCode } = runCli(["verify", ".", "--json"]);
    const parsed = JSON.parse(stdout);
    expect(parsed.findings).toBeInstanceOf(Array);
    expect(exitCode).toBe(0);
    // PR2: score is gone from the JSON shape.
    expect(parsed.score).toBeUndefined();
  });

  it("--fail-on off never exits 1", () => {
    const { exitCode } = runCli([
      "verify",
      "test/fixtures/bad",
      "--fail-on",
      "off",
    ]);
    expect(exitCode).toBe(0);
  });

  it("--fail-on error exits 1 for bad fixture", () => {
    const { exitCode } = runCli([
      "verify",
      "test/fixtures/bad",
      "--fail-on",
      "error",
    ]);
    expect(exitCode).toBe(1);
  });

  it("--fail-on warning exits 1 for fixture with warnings", () => {
    const { exitCode } = runCli([
      "verify",
      "test/fixtures/minimal",
      "--fail-on",
      "warning",
    ]);
    expect(exitCode).toBe(1);
  });

  it("--help shows usage", () => {
    const { stdout, exitCode } = runCli(["--help"]);
    expect(stdout).toContain("--format");
    expect(stdout).toContain("--fail-on");
    expect(stdout).toContain("--json");
    expect(exitCode).toBe(0);
  });

  it("verify --help prints usage and exits 0", () => {
    const { stdout, exitCode } = runCli(["verify", "--help"]);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("rootmark verify");
    expect(exitCode).toBe(0);
  });

  it("verify . --help prints usage and exits 0 without scanning", () => {
    const { stdout, exitCode } = runCli(["verify", ".", "--help"]);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("rootmark verify");
    // Must not produce a scan report — the --help short-circuit must run
    // before any scan, so no score line should appear.
    expect(stdout).not.toContain("rootmark score:");
    expect(exitCode).toBe(0);
  });

  it("--version matches package.json version", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
    const { stdout, exitCode } = runCli(["--version"]);
    expect(stdout.trim()).toBe(pkg.version);
    expect(exitCode).toBe(0);
  });

  it("returns exit code 2 for an unreadable root path without a stack trace", () => {
    const { stdout, stderr, exitCode } = runCli([
      "verify",
      "./definitely-not-existing-path",
    ]);
    expect(stdout).toBe("");
    expect(stderr).toContain(
      "Error: cannot read root path: ./definitely-not-existing-path",
    );
    expect(stderr).not.toContain("at ");
    expect(exitCode).toBe(2);
  });
  it("--format sarif outputs valid SARIF JSON", () => {
    const { stdout, exitCode } = runCli(["verify", ".", "--format", "sarif"]);
    const parsed = JSON.parse(stdout);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.$schema).toBe(
      "https://json.schemastore.org/sarif-2.1.0.json",
    );
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("--format sarif still prints results when findings cause exit 1", () => {
    const { stdout, exitCode } = runCli([
      "verify",
      "test/fixtures/bad",
      "--format",
      "sarif",
      "--fail-on",
      "error",
    ]);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });

  it("--format sarif with --fail-on off exits 0 even with findings", () => {
    const { stdout, exitCode } = runCli([
      "verify",
      "test/fixtures/bad",
      "--format",
      "sarif",
      "--fail-on",
      "off",
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.runs)).toBe(true);
    expect(parsed.runs[0].results.length).toBeGreaterThan(0);
  });

  it("unknown --format exits 2", () => {
    const { stderr, exitCode } = runCli(["verify", ".", "--format", "notreal"]);
    expect(stderr).toContain("Unknown format: notreal");
    expect(exitCode).toBe(2);
  });
});
