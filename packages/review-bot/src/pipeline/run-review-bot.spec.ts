import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runReviewBot } from "./run-review-bot";
import { TempRepo } from "../explore/test-support/temp-repo";

/**
 * End-to-end tests for the full bot (Explore → 4 reviewers → normalize →
 * deduplicate → filter). Requirements 1–6 and 9 from Step 8; requirements
 * 7 (dedup) and 8 (confidence filtering) are proven directly and more
 * precisely in pipeline.spec.ts's unit tests, with #8 additionally proven
 * end-to-end here (test "filters a low-confidence finding...").
 */

let repo: TempRepo;

beforeEach(() => {
  repo = TempRepo.create();
});

afterEach(() => {
  repo.cleanup();
});

describe("runReviewBot — core benchmark-style behavior", () => {
  it("flags a seeded-style logic bug, an untested code path, and a hardcoded secret; stays silent on clean code and unrelated files", () => {
    // File 1: a boundary-comparison bug (DEFECT-1 shape).
    repo.writeFile("src/scoring.ts", ['export function getLevel(score: number): string {', '  if (score >= 66) return "HIGH";', '  if (score >= 33) return "MEDIUM";', '  return "LOW";', "}", ""].join("\n"));
    repo.writeFile("src/scoring.spec.ts", 'import { getLevel } from "./scoring";\nit("maps 66 to HIGH", () => { getLevel(66); });\n');

    // File 2: a new branch added without a corresponding test update (DEFECT-2 shape).
    repo.writeFile("src/opportunities.ts", ["export function findOpportunities(input: { brokenLinks: number }) {", "  const findings: string[] = [];", "  return findings;", "}", ""].join("\n"));
    repo.writeFile("src/opportunities.spec.ts", 'import { findOpportunities } from "./opportunities";\nit("returns no findings by default", () => { findOpportunities({ brokenLinks: 0 }); });\n');

    // File 3: a config object with an api key read from env (DEFECT-3 shape after the change).
    repo.writeFile("src/config.ts", ["export const config = {", "  apiKey: process.env.API_KEY,", "};", ""].join("\n"));

    // File 4: an unrelated file with an OBVIOUS, real issue that this PR never touches.
    repo.writeFile("src/untouched-secret.ts", 'export const legacyApiKey = "AIzaSyREALLOOKINGBUTUNTOUCHEDFILEKEY00";\n');

    // File 5: a clean, well-tested change — should never be flagged.
    repo.writeFile("src/util.ts", "export function double(n: number): number {\n  return n * 2;\n}\n");
    repo.writeFile("src/util.spec.ts", 'import { double } from "./util";\nit("doubles", () => { expect(double(2)).toBe(4); });\n');
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    repo.writeFile("src/scoring.ts", ['export function getLevel(score: number): string {', '  if (score > 66) return "HIGH";', '  if (score >= 33) return "MEDIUM";', '  return "LOW";', "}", ""].join("\n"));
    repo.writeFile(
      "src/opportunities.ts",
      ["export function findOpportunities(input: { brokenLinks: number }) {", "  const findings: string[] = [];", "  if (input.brokenLinks > 0) {", '    findings.push("broken links found");', "  }", "  return findings;", "}", ""].join("\n"),
    );
    repo.writeFile("src/config.ts", ["export const config = {", '  apiKey: process.env.API_KEY ?? "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",', "};", ""].join("\n"));
    repo.writeFile("src/util.ts", "export function double(n: number): number {\n  return n * 2; // clarifying comment, no behavior change\n}\n");
    // src/untouched-secret.ts is deliberately NOT touched in this commit.
    repo.commitAll("feature work");

    const findings = runReviewBot({ repoPath: repo.path, baseRef: "main", headRef: "feature" });

    // --- Requirement 1: seeded-style logic bug flagged ---
    const logicFinding = findings.find((f) => f.category === "logic-error");
    expect(logicFinding).toBeDefined();
    expect(logicFinding?.file).toBe("src/scoring.ts");

    // --- Requirement 2: meaningful untested code path flagged ---
    const testFinding = findings.find((f) => f.category === "missing-tests");
    expect(testFinding).toBeDefined();
    expect(testFinding?.file).toBe("src/opportunities.ts");

    // --- Requirement 3: hardcoded synthetic secret flagged ---
    const securityFinding = findings.find((f) => f.category === "security");
    expect(securityFinding).toBeDefined();
    expect(securityFinding?.file).toBe("src/config.ts");
    expect(securityFinding?.evidence).toContain("AIzaSy");

    // --- Requirement 4: clean, well-tested change is NOT flagged ---
    expect(findings.some((f) => f.file === "src/util.ts")).toBe(false);

    // --- Requirement 5: every finding matches the required structured schema ---
    for (const f of findings) {
      for (const field of ["id", "source", "category", "severity", "title", "file", "line", "explanation", "evidence", "suggested_fix", "confidence"]) {
        expect(f).toHaveProperty(field);
      }
      expect(["logic-error", "missing-tests", "security", "style-maintainability"]).toContain(f.category);
      expect(["MUST-FIX", "SHOULD-FIX"]).toContain(f.severity); // never IGNORE — filtered before reaching here
      expect(["high", "medium"]).toContain(f.confidence); // never low — filtered before reaching here
    }

    // --- Requirement 6: severity matches the rubric for each seeded-style defect ---
    expect(logicFinding?.severity).toBe("MUST-FIX");
    expect(testFinding?.severity).toBe("SHOULD-FIX");
    expect(securityFinding?.severity).toBe("MUST-FIX");

    // --- Requirement 9: does not report unrelated unchanged code ---
    expect(findings.some((f) => f.file === "src/untouched-secret.ts")).toBe(false);
    const changedPaths = new Set(["src/scoring.ts", "src/opportunities.ts", "src/config.ts", "src/util.ts"]);
    for (const f of findings) {
      expect(changedPaths.has(f.file)).toBe(true);
    }
  });

  it("filters a low-confidence finding that a reviewer would otherwise produce", () => {
    // A large, flat (not deeply nested) added block — triggers Style's
    // "large block" detector, which is deliberately confidence: "low".
    const lines = Array.from({ length: 65 }, (_, i) => `  const v${i} = ${i};`);
    repo.writeFile("src/big.ts", "export function setup() {\n}\n");
    repo.writeFile("src/big.spec.ts", 'import { setup } from "./big";\nit("runs", () => { setup(); });\n');
    repo.commitAll("base");
    repo.checkoutNewBranch("feature");
    repo.writeFile("src/big.ts", `export function setup() {\n${lines.join("\n")}\n}\n`);
    repo.commitAll("add a large flat block");

    const findings = runReviewBot({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    expect(findings.some((f) => f.file === "src/big.ts")).toBe(false);
  });
});
