import { describe, expect, it } from "vitest";
import { reviewLogic } from "./logic-reviewer";
import type { LogicReviewInput } from "../shared/types";
import type { ChangeHunkSummary } from "../../explore/types";

/** Test helper: builds a ChangeHunkSummary, auto-deriving addedLineNumbers (sequential from startLine) unless explicitly overridden. */
function hunk(overrides: Partial<ChangeHunkSummary> & { excerpt: string }): ChangeHunkSummary {
  const base: ChangeHunkSummary = { header: "@@", startLine: 1, endLine: 1, truncated: false, addedLineNumbers: [], ...overrides };
  if (!overrides.addedLineNumbers) {
    const addedCount = base.excerpt.split("\n").filter((l) => l.startsWith("+")).length;
    base.addedLineNumbers = Array.from({ length: addedCount }, (_, i) => base.startLine + i);
  }
  return base;
}

function input(path: string, hunks: ChangeHunkSummary[], changedSymbols: LogicReviewInput["files"][number]["changedSymbols"] = []): LogicReviewInput {
  return {
    files: [{ path, changeKind: "modified", linesAdded: 1, linesRemoved: 1, hunks, changedSymbols }],
  };
}

describe("reviewLogic — comparison operator flip", () => {
  it("flags a threshold comparison whose operator changed (the DEFECT-1 shape)", () => {
    const findings = reviewLogic(
      input("packages/providers/src/audit/opportunity-scoring.ts", [
        hunk({
          startLine: 22,
          endLine: 22,
          excerpt: '-  if (score >= 66) return "HIGH";\n+  if (score > 66) return "HIGH";',
        }),
      ]),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      category: "logic-error",
      severity: "MUST-FIX",
      file: "packages/providers/src/audit/opportunity-scoring.ts",
      line: "22",
      confidence: "high",
    });
    expect(findings[0]?.evidence).toContain(">= 66");
    expect(findings[0]?.evidence).toContain("> 66");
  });

  it("does not flag when the operator is unchanged", () => {
    const findings = reviewLogic(
      input("src/x.ts", [hunk({ excerpt: '-  if (score >= 66) return "HIGH";\n+  if (score >= 66) return "HIGH2";' })]),
    );
    expect(findings).toEqual([]);
  });

  it("does not flag when the operand or threshold also changed (not purely a boundary flip)", () => {
    const findings = reviewLogic(input("src/x.ts", [hunk({ excerpt: "-  if (score >= 66) return true;\n+  if (score >= 70) return true;" })]));
    expect(findings).toEqual([]);
  });

  it("does not flag an ambiguous multi-line hunk (more than one removed/added line)", () => {
    const findings = reviewLogic(
      input("src/x.ts", [
        hunk({
          excerpt: "-  if (score >= 66) return true;\n-  doOtherThing();\n+  if (score > 66) return true;\n+  doOtherThing();",
        }),
      ]),
    );
    expect(findings).toEqual([]); // conservative: ambiguous pairing is not evidence enough
  });
});

describe("reviewLogic — off-by-one length comparison", () => {
  it("flags a newly-added `<= x.length` comparison", () => {
    const findings = reviewLogic(input("src/x.ts", [hunk({ excerpt: "+  for (let i = 0; i <= arr.length; i++) {" })]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "logic-error", severity: "SHOULD-FIX", confidence: "medium" });
  });

  it("does not flag when the `<= x.length` pattern already existed (not newly introduced)", () => {
    const findings = reviewLogic(
      input("src/x.ts", [hunk({ excerpt: "-  for (let i = 0; i <= arr.length; i++) {\n+  for (let i = 0; i <= arr.length; i++) { // reformatted" })]),
    );
    expect(findings).toEqual([]);
  });
});

describe("reviewLogic — conservatism", () => {
  it("produces no findings for an unremarkable change", () => {
    const findings = reviewLogic(input("src/x.ts", [hunk({ excerpt: "+  const label = formatLabel(name);" })]));
    expect(findings).toEqual([]);
  });

  it("skips deleted files entirely", () => {
    const findings = reviewLogic({
      files: [
        {
          path: "src/gone.ts",
          changeKind: "deleted",
          linesAdded: 0,
          linesRemoved: 5,
          hunks: [hunk({ excerpt: "-  if (score >= 66) return true;" })],
          changedSymbols: [],
        },
      ],
    });
    expect(findings).toEqual([]);
  });

  it("every finding includes all required rubric fields", () => {
    const findings = reviewLogic(
      input("src/x.ts", [hunk({ excerpt: '-  if (score >= 66) return "HIGH";\n+  if (score > 66) return "HIGH";' })]),
    );
    for (const field of ["category", "severity", "title", "file", "line", "explanation", "evidence", "suggested_fix", "confidence"]) {
      expect(findings[0]).toHaveProperty(field);
    }
  });
});
