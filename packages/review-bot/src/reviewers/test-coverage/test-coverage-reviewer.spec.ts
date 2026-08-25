import { describe, expect, it } from "vitest";
import { reviewTestCoverage } from "./test-coverage-reviewer";
import type { TestCoverageReviewInput } from "../shared/types";
import type { ChangeHunkSummary, RelevantTestFile } from "../../explore/types";

function hunk(overrides: Partial<ChangeHunkSummary> & { excerpt: string }): ChangeHunkSummary {
  const base: ChangeHunkSummary = { header: "@@", startLine: 100, endLine: 110, truncated: false, addedLineNumbers: [], ...overrides };
  if (!overrides.addedLineNumbers) {
    const addedCount = base.excerpt.split("\n").filter((l) => l.startsWith("+")).length;
    base.addedLineNumbers = Array.from({ length: addedCount }, (_, i) => base.startLine + i);
  }
  return base;
}

function fileInput(overrides: Partial<TestCoverageReviewInput["files"][number]>): TestCoverageReviewInput {
  return {
    files: [
      {
        path: "src/thing.ts",
        changeKind: "modified",
        linesAdded: 10,
        linesRemoved: 0,
        hunks: [],
        changedSymbols: [{ name: "doThing", kind: "function", line: 1 }],
        relevantTests: [],
        ...overrides,
      },
    ],
  };
}

describe("reviewTestCoverage — new branch without test update (DEFECT-2 shape)", () => {
  const untouchedSpec: RelevantTestFile = { path: "src/thing.spec.ts", changedInDiff: false, matchedBy: "co-located-spec" };

  it("flags a new conditional branch added to a function whose test file wasn't touched", () => {
    const findings = reviewTestCoverage(
      fileInput({
        relevantTests: [untouchedSpec],
        hunks: [hunk({ excerpt: '+    if (extraction.brokenLinksFound > 0) {\n+      findings.push({ title: "Broken links" });\n+    }' })],
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "missing-tests", severity: "SHOULD-FIX", file: "src/thing.ts" });
    expect(findings[0]?.evidence).toContain("if (extraction.brokenLinksFound > 0)");
  });

  it("does not flag when the relevant test WAS changed in this diff", () => {
    const findings = reviewTestCoverage(
      fileInput({
        relevantTests: [{ ...untouchedSpec, changedInDiff: true }],
        hunks: [hunk({ excerpt: "+    if (x) { doThing(); }" })],
      }),
    );
    expect(findings).toEqual([]);
  });

  it("does not flag a change with no new branch keyword, even with an untouched test file", () => {
    const findings = reviewTestCoverage(fileInput({ relevantTests: [untouchedSpec], hunks: [hunk({ excerpt: "+    const x = compute();" })] }));
    expect(findings).toEqual([]);
  });
});

describe("reviewTestCoverage — no test coverage at all", () => {
  it("flags a meaningful function-level change with zero relevant tests found", () => {
    const findings = reviewTestCoverage(fileInput({ relevantTests: [], linesAdded: 10, linesRemoved: 2, hunks: [hunk({ excerpt: "+  export function doThing() { return 1; }" })] }));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "missing-tests", severity: "SHOULD-FIX" });
  });

  it("does NOT flag merely because a trivial change has no test (conservatism requirement)", () => {
    const findings = reviewTestCoverage(
      fileInput({ relevantTests: [], linesAdded: 1, linesRemoved: 1, changedSymbols: [{ name: "LABEL", kind: "const", line: 1 }], hunks: [hunk({ excerpt: '+export const LABEL = "v2";' })] }),
    );
    expect(findings).toEqual([]); // const-only, tiny diff — not "meaningful changed behavior"
  });

  it("does not flag when a relevant test already exists (even if unrelated to the specific line)", () => {
    const findings = reviewTestCoverage(
      fileInput({ relevantTests: [{ path: "src/thing.spec.ts", changedInDiff: false, matchedBy: "co-located-spec" }], hunks: [] }),
    );
    expect(findings).toEqual([]);
  });
});

describe("reviewTestCoverage — updated test doesn't reference the changed symbol", () => {
  it("flags when the changed test file's content never mentions the changed symbol", () => {
    const findings = reviewTestCoverage(
      fileInput({
        changedSymbols: [{ name: "addNumbers", kind: "function", line: 1 }],
        relevantTests: [{ path: "src/thing.spec.ts", changedInDiff: true, matchedBy: "co-located-spec" }],
        hunks: [hunk({ excerpt: "+export function addNumbers(a, b) { return a + b; }" })],
      }),
      (path) => (path === "src/thing.spec.ts" ? 'it("does something unrelated", () => { expect(1).toBe(1); });' : null),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("addNumbers");
  });

  it("does not flag when the changed test file DOES mention the changed symbol", () => {
    const findings = reviewTestCoverage(
      fileInput({
        changedSymbols: [{ name: "addNumbers", kind: "function", line: 1 }],
        relevantTests: [{ path: "src/thing.spec.ts", changedInDiff: true, matchedBy: "co-located-spec" }],
        hunks: [hunk({ excerpt: "+export function addNumbers(a, b) { return a + b; }" })],
      }),
      (path) => (path === "src/thing.spec.ts" ? 'it("adds", () => { addNumbers(1, 2); });' : null),
    );
    expect(findings).toEqual([]);
  });
});

describe("reviewTestCoverage — general conservatism", () => {
  it("skips deleted files", () => {
    const findings = reviewTestCoverage(fileInput({ changeKind: "deleted", relevantTests: [], hunks: [] }));
    expect(findings).toEqual([]);
  });

  it("every finding includes all required rubric fields", () => {
    const findings = reviewTestCoverage(fileInput({ relevantTests: [], linesAdded: 10, hunks: [hunk({ excerpt: "+  export function doThing() { return 1; }" })] }));
    for (const field of ["category", "severity", "title", "file", "line", "explanation", "evidence", "suggested_fix", "confidence"]) {
      expect(findings[0]).toHaveProperty(field);
    }
  });
});
