import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPlan } from "./plan";
import type { ChangedFileSummary, ChangeHunkSummary, ExploreContextPackage, RiskFlag } from "../explore/types";

function hunk(overrides: Partial<ChangeHunkSummary> & { excerpt: string }): ChangeHunkSummary {
  const base: ChangeHunkSummary = { header: "@@", startLine: 1, endLine: 1, truncated: false, addedLineNumbers: [], ...overrides };
  if (!overrides.addedLineNumbers) {
    const addedCount = base.excerpt.split("\n").filter((l) => l.startsWith("+")).length;
    base.addedLineNumbers = Array.from({ length: addedCount }, (_, i) => base.startLine + i);
  }
  return base;
}

function file(overrides: Partial<ChangedFileSummary> & { path: string }): ChangedFileSummary {
  return {
    changeKind: "modified",
    linesAdded: 1,
    linesRemoved: 1,
    purpose: "p",
    changedSymbols: [],
    hunks: [],
    callers: [],
    relevantTests: [],
    potentiallyAffectedBehavior: [],
    riskFlags: [],
    missingContext: [],
    ...overrides,
  };
}

function pkg(files: ChangedFileSummary[]): ExploreContextPackage {
  return { baseRef: "main", headRef: "feature", mergeBase: "abc1234", generatedAt: new Date().toISOString(), changedFiles: files, globalMissingContext: [], summary: "test" };
}

describe("createPlan — routing (proof points 1-4)", () => {
  it("1. routes a logic-shaped change (a real code hunk) to the logic reviewer", () => {
    const plan = createPlan(
      pkg([file({ path: "src/scoring.ts", hunks: [hunk({ excerpt: '+  if (score > 66) return "HIGH";' })] })]),
    );
    const area = plan.areas.find((a) => a.file === "src/scoring.ts");
    expect(area).toBeDefined();
    expect(area?.selectedReviewers).toContain("logic");
  });

  it("2. routes a function/class-level change to the test-coverage reviewer", () => {
    const plan = createPlan(
      pkg([
        file({
          path: "src/opportunities.ts",
          changedSymbols: [{ name: "findOpportunities", kind: "function", line: 1 }],
          hunks: [hunk({ excerpt: "+  if (x) { y(); }" })],
        }),
      ]),
    );
    const area = plan.areas.find((a) => a.file === "src/opportunities.ts");
    expect(area?.selectedReviewers).toContain("test-coverage");
  });

  it("3. routes a security-sensitive change (Explore risk flag) to the security reviewer", () => {
    const riskFlag: RiskFlag = { kind: "possible-hardcoded-secret", description: "d" };
    const plan = createPlan(
      pkg([file({ path: "apps/worker/src/config/env.ts", riskFlags: [riskFlag], hunks: [hunk({ excerpt: '+  apiKey: "x",' })] })]),
    );
    const area = plan.areas.find((a) => a.file === "apps/worker/src/config/env.ts");
    expect(area?.selectedReviewers).toContain("security");
    expect(area?.priority).toBe("high");
  });

  it("3b. routes a change to a *.controller.ts file to the security reviewer even with no risk flag", () => {
    const plan = createPlan(
      pkg([file({ path: "apps/api/src/leads/leads.controller.ts", hunks: [hunk({ excerpt: "+  @Get(':id')\n+  get() {}" })] })]),
    );
    const area = plan.areas.find((a) => a.file === "apps/api/src/leads/leads.controller.ts");
    expect(area?.selectedReviewers).toContain("security");
  });

  it("4. routes any real code change to the style/maintainability reviewer", () => {
    const plan = createPlan(pkg([file({ path: "src/util.ts", hunks: [hunk({ excerpt: "+  const x = 1;" })] })]));
    const area = plan.areas.find((a) => a.file === "src/util.ts");
    expect(area?.selectedReviewers).toContain("style-maintainability");
  });
});

describe("createPlan — exclusion (proof point 5)", () => {
  it("does not route a pure documentation change to any reviewer", () => {
    const plan = createPlan(pkg([file({ path: "README.md", hunks: [hunk({ excerpt: "+Some new docs line." })] })]));
    expect(plan.areas.find((a) => a.file === "README.md")).toBeUndefined();
    expect(plan.ignoredFiles.some((f) => f.file === "README.md")).toBe(true);
    expect(plan.selectedReviewers).toEqual([]);
  });

  it("does not route a JSON/config change to any reviewer", () => {
    const plan = createPlan(pkg([file({ path: "package.json", hunks: [hunk({ excerpt: '+  "version": "1.0.1"' })] })]));
    expect(plan.areas.find((a) => a.file === "package.json")).toBeUndefined();
  });

  it("does not route a deleted file to any reviewer", () => {
    const plan = createPlan(pkg([file({ path: "src/old.ts", changeKind: "deleted", hunks: [hunk({ excerpt: "-export function old() {}" })] })]));
    expect(plan.areas.find((a) => a.file === "src/old.ts")).toBeUndefined();
    expect(plan.ignoredFiles.some((f) => f.file === "src/old.ts")).toBe(true);
  });

  it("routes a non-security, non-symbol code change to logic+style only — not to every reviewer", () => {
    const plan = createPlan(pkg([file({ path: "src/tweak.ts", hunks: [hunk({ excerpt: "+  console.log(x);" })] })]));
    const area = plan.areas.find((a) => a.file === "src/tweak.ts");
    expect(area?.selectedReviewers.sort()).toEqual(["logic", "style-maintainability"].sort());
    expect(area?.selectedReviewers).not.toContain("security");
    expect(area?.selectedReviewers).not.toContain("test-coverage");
  });

  it("a PR of only non-code files selects zero reviewers overall", () => {
    const plan = createPlan(pkg([file({ path: "README.md", hunks: [hunk({ excerpt: "+x" })] }), file({ path: "docs/notes.md", hunks: [hunk({ excerpt: "+y" })] })]));
    expect(plan.selectedReviewers).toEqual([]);
    expect(plan.relevantFiles).toEqual([]);
    expect(plan.ignoredFiles).toHaveLength(2);
  });
});

describe("createPlan — schema (proof point 6)", () => {
  it("every area includes all required fields with the correct shapes", () => {
    const plan = createPlan(
      pkg([
        file({
          path: "src/x.ts",
          changedSymbols: [{ name: "doThing", kind: "function", line: 1 }],
          hunks: [hunk({ excerpt: "+  if (x) {}" })],
        }),
      ]),
    );
    expect(plan).toHaveProperty("reviewScope");
    expect(typeof plan.reviewScope).toBe("string");
    expect(plan).toHaveProperty("selectedReviewers");
    expect(Array.isArray(plan.selectedReviewers)).toBe(true);
    expect(plan).toHaveProperty("relevantFiles");
    expect(Array.isArray(plan.relevantFiles)).toBe(true);
    expect(plan).toHaveProperty("areas");
    expect(plan).toHaveProperty("ignoredFiles");

    const area = plan.areas[0]!;
    for (const field of ["file", "relevantSymbols", "selectedReviewers", "rationale", "contextRequirements", "priority"]) {
      expect(area).toHaveProperty(field);
    }
    expect(Array.isArray(area.relevantSymbols)).toBe(true);
    expect(area.relevantSymbols).toContain("doThing");
    expect(Array.isArray(area.selectedReviewers)).toBe(true);
    expect(typeof area.rationale).toBe("string");
    expect(area.rationale.length).toBeGreaterThan(0);
    expect(Array.isArray(area.contextRequirements)).toBe(true);
    expect(["high", "medium", "low"]).toContain(area.priority);
  });

  it("the whole Plan is JSON-serializable (no functions/undefined leaking through)", () => {
    const plan = createPlan(pkg([file({ path: "src/x.ts", hunks: [hunk({ excerpt: "+x" })] })]));
    const roundTripped = JSON.parse(JSON.stringify(plan));
    expect(roundTripped).toEqual(plan);
  });

  it("is deterministic — the same input produces the identical output", () => {
    const input = pkg([
      file({ path: "src/a.ts", changedSymbols: [{ name: "f", kind: "function", line: 1 }], hunks: [hunk({ excerpt: "+x" })] }),
      file({ path: "README.md", hunks: [hunk({ excerpt: "+y" })] }),
    ]);
    expect(createPlan(input)).toEqual(createPlan(input));
  });
});

describe("createPlan — no hidden benchmark knowledge (proof point 7)", () => {
  it("Plan's own source code never references the benchmark's specific file paths or defect identifiers", () => {
    const source = readFileSync(join(__dirname, "plan.ts"), "utf8");
    const forbidden = [
      "opportunity-scoring",
      "growth-opportunities",
      "googlePlacesApiKey",
      "DEFECT-1",
      "DEFECT-2",
      "DEFECT-3",
      "assignment/seeded-defects",
      "AIzaSyBENCHMARK",
    ];
    for (const needle of forbidden) {
      expect(source).not.toContain(needle);
    }
  });

  it("routes a file shaped like DEFECT-1 (a boundary comparison) to logic using only generic signals — never by recognizing the specific file", () => {
    // Same *shape* as the real DEFECT-1 hunk, but a different file entirely
    // — proves routing is driven by the hunk's content/symbol kind, not by
    // knowing where the real defect lives.
    const plan = createPlan(
      pkg([
        file({
          path: "src/totally-different-module.ts",
          changedSymbols: [{ name: "getLevel", kind: "function", line: 1 }],
          hunks: [hunk({ excerpt: '-  if (score >= 66) return "HIGH";\n+  if (score > 66) return "HIGH";' })],
        }),
      ]),
    );
    const area = plan.areas.find((a) => a.file === "src/totally-different-module.ts");
    expect(area?.selectedReviewers).toContain("logic");
  });

  it("never references the ground-truth file, and has no filesystem-read call of any kind", () => {
    // A doc-comment mentioning docs/assignment/subagent-architecture.md
    // (pointing a reader at the design doc) is fine and expected — the
    // actual concern is (a) the ground-truth file specifically, and (b)
    // any runtime file-read at all, since Plan's only legitimate input is
    // the ExploreContextPackage object it's called with, never a file it
    // goes and reads itself.
    const source = readFileSync(join(__dirname, "plan.ts"), "utf8");
    expect(source).not.toMatch(/benchmark-ground-truth/);
    expect(source).not.toMatch(/readFileSync|readFile\(|require\(["']fs["']|from ["']node:fs["']|from ["']fs["']/);
  });
});
