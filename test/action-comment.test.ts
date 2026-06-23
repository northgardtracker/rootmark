import { describe, expect, it } from "vitest";
import {
  PR_COMMENT_MARKER,
  MAX_FINDINGS_IN_COMMENT,
  escapeTableCell,
  evaluateThreshold,
  renderComment,
  severityLabel,
  summarize,
} from "../src/action-comment.js";
import type { Finding, ScanResult } from "../src/types.js";
// Runtime mirror used by the composite action. Imported here so we can assert
// it never drifts from the canonical TypeScript module above.
import * as runtime from "../action/lib.mjs";

function makeResult(
  findings: Finding[],
  over: Partial<ScanResult> = {},
): ScanResult {
  return {
    root: "/repo",
    files: ["AGENTS.md"],
    findings,
    ...over,
  };
}

const FAIL_FINDING: Finding = {
  id: "dangerous-instruction.system-override",
  severity: "fail",
  title: "System override instruction",
  message: "Instruction override language can behave like prompt injection.",
  file: "AGENTS.md",
  evidence: "ignore previous instructions",
  remediation: "Replace with a scoped, auditable rule.",
};

const WARN_FINDING: Finding = {
  id: "context-bloat.too-long",
  severity: "warn",
  title: "Instruction file may be too large",
  message: "This file has about 1200 words.",
  file: "AGENTS.md",
  remediation: "Move long reference material into docs/.",
};

// ── severityLabel ──────────────────────────────────────────────────────────

describe("severityLabel", () => {
  it("maps internal severities to public labels", () => {
    expect(severityLabel("fail")).toBe("error");
    expect(severityLabel("warn")).toBe("warning");
    expect(severityLabel("info")).toBe("info");
  });

  it("passes through unknown severities unchanged", () => {
    expect(severityLabel("something-else")).toBe("something-else");
  });
});

// ── escapeTableCell ──────────────────────────────────────────────────────────

describe("escapeTableCell", () => {
  it("returns empty string for undefined/null", () => {
    expect(escapeTableCell(undefined)).toBe("");
    expect(escapeTableCell(null)).toBe("");
  });

  it("escapes pipe characters so they cannot break a table row", () => {
    expect(escapeTableCell("a | b")).toBe("a \\| b");
    expect(escapeTableCell("x|y|z")).toBe("x\\|y\\|z");
  });

  it("collapses newlines (CRLF, CR, LF) into spaces", () => {
    expect(escapeTableCell("line1\nline2")).toBe("line1 line2");
    expect(escapeTableCell("line1\r\nline2")).toBe("line1 line2");
    expect(escapeTableCell("line1\rline2")).toBe("line1 line2");
  });

  it("trims surrounding whitespace", () => {
    expect(escapeTableCell("  trimmed  ")).toBe("trimmed");
  });
});

// ── renderComment ────────────────────────────────────────────────────────────

describe("renderComment", () => {
  it('renders a clean "No findings" comment with the hidden marker', () => {
    const body = renderComment(makeResult([]));
    expect(body.startsWith(PR_COMMENT_MARKER)).toBe(true);
    expect(body).toContain("## Rootmark report");
    expect(body).toContain("- **Instruction files scanned:** 1");
    expect(body).toContain("- **Findings:** 0");
    expect(body).toContain("No findings.");
    // PR2 anti-regression: the Score line must never come back.
    expect(body).not.toContain("- **Score:**");
    expect(body).not.toContain(
      "| Severity | Rule | File | Evidence | Remediation |",
    );
  });

  it("renders a findings table with mapped severities and the rule id", () => {
    const body = renderComment(
      makeResult([FAIL_FINDING, WARN_FINDING]),
    );
    expect(body).toContain("- **Findings:** 2");
    expect(body).toContain(
      "| Severity | Rule | File | Evidence | Remediation |",
    );
    expect(body).toContain("| --- | --- | --- | --- | --- |");
    expect(body).toContain(
      "| error | dangerous-instruction.system-override | AGENTS.md | ignore previous instructions |",
    );
    expect(body).toContain(
      "| warning | context-bloat.too-long | AGENTS.md |  |",
    );
  });

  it("escapes pipes and newlines in user-controlled finding fields", () => {
    const nasty: Finding = {
      id: "rule.with|pipe",
      severity: "fail",
      title: "t",
      message: "m",
      file: "AGENTS.md",
      evidence: "do A | do B\nsecond line",
      remediation: "fix | it",
    };
    const body = renderComment(makeResult([nasty]));
    expect(body).toContain("do A \\| do B second line");
    expect(body).toContain("rule.with\\|pipe");
    expect(body).toContain("fix \\| it");
    // The raw (unescaped) sequence must not survive into a table row.
    expect(body).not.toContain("do A | do B");
    expect(body).not.toContain("do B\nsecond line");
  });

  it("caps findings at the configured maximum and notes the remainder", () => {
    const many: Finding[] = Array.from({ length: 30 }, (_, i) => ({
      id: `rule-${i}`,
      severity: "warn",
      title: `t${i}`,
      message: `m${i}`,
      file: "AGENTS.md",
    }));
    const body = renderComment(makeResult(many));
    const rows = body
      .split("\n")
      .filter((line) => line.startsWith("| warning |"));
    expect(rows).toHaveLength(MAX_FINDINGS_IN_COMMENT);
    expect(body).toContain("rule-0");
    expect(body).not.toContain("rule-25");
    expect(body).toContain("…and 5 more findings not shown");
    expect(body).toContain("the workflow logs or the JSON output");
  });

  it("honors a custom maxFindings and singular phrasing for one omitted finding", () => {
    const findings: Finding[] = Array.from({ length: 3 }, (_, i) => ({
      id: `rule-${i}`,
      severity: "fail",
      title: "t",
      message: "m",
    }));
    const body = renderComment(makeResult(findings), { maxFindings: 2 });
    expect(body).toContain("…and 1 more finding not shown");
  });

  it("links to the workflow run when detailsUrl is provided and findings are omitted", () => {
    const findings: Finding[] = Array.from({ length: 3 }, (_, i) => ({
      id: `rule-${i}`,
      severity: "fail",
      title: "t",
      message: "m",
    }));
    const body = renderComment(makeResult(findings), {
      maxFindings: 1,
      detailsUrl: "https://example.com/run/42",
    });
    expect(body).toContain("[workflow logs](https://example.com/run/42)");
  });
});

// ── evaluateThreshold ─────────────────────────────────────────────────────────

describe("evaluateThreshold", () => {
  const fail: Finding[] = [
    { id: "a", severity: "fail", title: "t", message: "m" },
  ];
  const warn: Finding[] = [
    { id: "b", severity: "warn", title: "t", message: "m" },
  ];
  const info: Finding[] = [
    { id: "c", severity: "info", title: "t", message: "m" },
  ];

  it('error: fails only on internal severity "fail"', () => {
    expect(evaluateThreshold(fail, "error").shouldFail).toBe(true);
    expect(evaluateThreshold(warn, "error").shouldFail).toBe(false);
    expect(evaluateThreshold(info, "error").shouldFail).toBe(false);
    expect(evaluateThreshold([], "error").shouldFail).toBe(false);
  });

  it('warning: fails on "warn" or "fail"', () => {
    expect(evaluateThreshold(fail, "warning").shouldFail).toBe(true);
    expect(evaluateThreshold(warn, "warning").shouldFail).toBe(true);
    expect(evaluateThreshold(info, "warning").shouldFail).toBe(false);
    expect(evaluateThreshold([], "warning").shouldFail).toBe(false);
  });

  it("off: never fails", () => {
    expect(evaluateThreshold(fail, "off").shouldFail).toBe(false);
    expect(evaluateThreshold(warn, "off").shouldFail).toBe(false);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(evaluateThreshold(fail, "ERROR").shouldFail).toBe(true);
    expect(evaluateThreshold(warn, "  Warning ").shouldFail).toBe(true);
    expect(evaluateThreshold(fail, "OFF").shouldFail).toBe(false);
  });

  it("throws a clear error on an invalid value", () => {
    expect(() => evaluateThreshold(fail, "sometimes")).toThrow(
      /Invalid fail-on value/,
    );
    expect(() => evaluateThreshold(fail, "")).toThrow(/Invalid fail-on value/);
  });

  it("returns the normalized failOn for reporting", () => {
    expect(evaluateThreshold(fail, "ERROR").failOn).toBe("error");
    expect(evaluateThreshold(warn, "warning").failOn).toBe("warning");
    expect(evaluateThreshold([], "off").failOn).toBe("off");
  });
});

// ── summarize ─────────────────────────────────────────────────────────────────

describe("summarize", () => {
  it("extracts the findings count", () => {
    expect(
      summarize(makeResult([FAIL_FINDING, WARN_FINDING])),
    ).toEqual({
      findingsCount: 2,
    });
  });

  it("is defensive against malformed results", () => {
    expect(summarize({} as ScanResult)).toEqual({ findingsCount: 0 });
  });
});

// ── Runtime parity: action/lib.mjs must match src/action-comment.ts ───────────

describe("runtime mirror parity (action/lib.mjs)", () => {
  it("exports identical constants", () => {
    expect(runtime.PR_COMMENT_MARKER).toBe(PR_COMMENT_MARKER);
    expect(runtime.MAX_FINDINGS_IN_COMMENT).toBe(MAX_FINDINGS_IN_COMMENT);
  });

  const cases: ScanResult[] = [
    makeResult([]),
    makeResult([FAIL_FINDING, WARN_FINDING], {
      files: ["AGENTS.md", "docs/CLAUDE.md"],
    }),
    makeResult(
      [
        {
          id: "r|x",
          severity: "fail",
          title: "t",
          message: "m",
          file: "a|b.md",
          evidence: "one | two\nthree",
          remediation: "do | this",
        },
      ],
    ),
    makeResult(
      Array.from({ length: 40 }, (_, i) => ({
        id: `rule-${i}`,
        severity: i % 2 === 0 ? "warn" : "fail",
        title: `t${i}`,
        message: `m${i}`,
        file: "AGENTS.md",
      })),
    ),
    {} as ScanResult,
  ];

  it("renderComment produces byte-identical output", () => {
    for (const result of cases) {
      expect(runtime.renderComment(result)).toBe(renderComment(result));
      expect(
        runtime.renderComment(result, {
          detailsUrl: "https://example.com/run/7",
          maxFindings: 3,
        }),
      ).toBe(
        renderComment(result, {
          detailsUrl: "https://example.com/run/7",
          maxFindings: 3,
        }),
      );
    }
  });

  it("escapeTableCell and severityLabel match", () => {
    for (const value of ["a | b", "line1\nline2", "  trim  ", "", "plain"]) {
      expect(runtime.escapeTableCell(value)).toBe(escapeTableCell(value));
    }
    for (const sev of ["fail", "warn", "info", "other"]) {
      expect(runtime.severityLabel(sev)).toBe(severityLabel(sev));
    }
  });

  it("evaluateThreshold matches for valid values", () => {
    const findings: Finding[] = [
      { id: "a", severity: "fail", title: "t", message: "m" },
      { id: "b", severity: "warn", title: "t", message: "m" },
    ];
    for (const value of ["error", "warning", "off", "ERROR", " warning "]) {
      expect(runtime.evaluateThreshold(findings, value)).toEqual(
        evaluateThreshold(findings, value),
      );
    }
  });

  it("evaluateThreshold both throw on invalid values", () => {
    expect(() => runtime.evaluateThreshold([], "nope")).toThrow(
      /Invalid fail-on value/,
    );
    expect(() => evaluateThreshold([], "nope")).toThrow(
      /Invalid fail-on value/,
    );
  });

  it("summarize matches", () => {
    for (const result of cases) {
      expect(runtime.summarize(result)).toEqual(summarize(result));
    }
  });
});
