import { describe, expect, it } from "vitest";
import { deduplicateFindings, filterFindings, normalizeFindings } from "./pipeline";
import type { Finding } from "../rubric/types";

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    category: "logic-error",
    severity: "MUST-FIX",
    title: "A finding",
    file: "src/x.ts",
    line: "10",
    explanation: "explanation",
    evidence: "evidence",
    suggested_fix: "fix it",
    confidence: "high",
    ...overrides,
  };
}

describe("normalizeFindings", () => {
  it("assigns a stable, unique id and records the source reviewer to every finding", () => {
    const normalized = normalizeFindings([
      { finding: finding({ title: "A" }), source: "logic" },
      { finding: finding({ title: "B" }), source: "security" },
    ]);
    expect(normalized).toHaveLength(2);
    expect(normalized[0]?.id).not.toBe(normalized[1]?.id);
    expect(normalized[0]?.source).toBe("logic");
    expect(normalized[1]?.source).toBe("security");
    // still a superset of the original Finding fields
    expect(normalized[0]).toMatchObject(finding({ title: "A" }));
  });
});

describe("deduplicateFindings", () => {
  it("collapses two findings that overlap in file+line, keeping the higher-severity one", () => {
    const a = { ...finding({ file: "src/x.ts", line: "10-12", severity: "SHOULD-FIX" }), id: "F1", source: "style-maintainability" as const };
    const b = { ...finding({ file: "src/x.ts", line: "11", severity: "MUST-FIX" }), id: "F2", source: "security" as const };
    const result = deduplicateFindings([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("F2");
    expect(result[0]?.severity).toBe("MUST-FIX");
  });

  it("does not collapse findings in different files, or non-overlapping lines in the same file", () => {
    const a = { ...finding({ file: "src/x.ts", line: "10" }), id: "F1", source: "logic" as const };
    const b = { ...finding({ file: "src/y.ts", line: "10" }), id: "F2", source: "logic" as const };
    const c = { ...finding({ file: "src/x.ts", line: "50" }), id: "F3", source: "logic" as const };
    const result = deduplicateFindings([a, b, c]);
    expect(result.map((f) => f.id).sort()).toEqual(["F1", "F2", "F3"]);
  });

  it("when severities tie, keeps the higher-confidence finding", () => {
    const a = { ...finding({ file: "src/x.ts", line: "10", severity: "SHOULD-FIX", confidence: "low" }), id: "F1", source: "style-maintainability" as const };
    const b = { ...finding({ file: "src/x.ts", line: "10", severity: "SHOULD-FIX", confidence: "high" }), id: "F2", source: "logic" as const };
    const result = deduplicateFindings([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("F2");
  });
});

describe("filterFindings", () => {
  it("drops low-confidence findings", () => {
    const kept = { ...finding({ confidence: "high" }), id: "F1", source: "logic" as const };
    const dropped = { ...finding({ confidence: "low" }), id: "F2", source: "style-maintainability" as const };
    const result = filterFindings([kept, dropped]);
    expect(result.map((f) => f.id)).toEqual(["F1"]);
  });

  it("keeps medium and high confidence findings", () => {
    const medium = { ...finding({ confidence: "medium" }), id: "F1", source: "logic" as const };
    const high = { ...finding({ confidence: "high" }), id: "F2", source: "logic" as const };
    const result = filterFindings([medium, high]);
    expect(result).toHaveLength(2);
  });

  it("drops any IGNORE-severity finding as a backstop, even though reviewers never emit one today", () => {
    const ignored = { ...finding({ severity: "IGNORE" }), id: "F1", source: "logic" as const };
    expect(filterFindings([ignored])).toEqual([]);
  });
});
