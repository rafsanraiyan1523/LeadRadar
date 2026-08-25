import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runExplore } from "../explore/explore";
import { readFileAtRef } from "../explore/git";
import { TempRepo } from "../explore/test-support/temp-repo";
import { reviewLogic } from "./logic/logic-reviewer";
import { reviewTestCoverage } from "./test-coverage/test-coverage-reviewer";
import { reviewSecurity } from "./security/security-reviewer";
import { reviewStyle } from "./style/style-reviewer";
import { narrowForLogicReview, narrowForSecurityReview, narrowForStyleReview, narrowForTestCoverageReview } from "./shared/types";

/**
 * End-to-end proof that Explore → reviewer actually works, using a
 * hermetic temp repo that replicates the *shape* of the three seeded
 * benchmark defects from docs/assignment/benchmark-ground-truth.md (a
 * boundary-comparison flip, an untested new branch, and a hardcoded
 * credential-shaped fallback) without depending on this repository's own
 * branch state. See benchmark-branch.integration.spec.ts for the
 * complementary test that runs against the real assignment/seeded-defects
 * branch.
 */

let repo: TempRepo;

beforeEach(() => {
  repo = TempRepo.create();
});

afterEach(() => {
  repo.cleanup();
});

function readFile(repoPath: string, headRef: string) {
  return (path: string) => readFileAtRef(repoPath, headRef, path);
}

describe("Explore → reviewers, on a benchmark-shaped diff", () => {
  it("each reviewer finds exactly its own defect, and stays silent on the others", () => {
    repo.writeFile(
      "src/scoring.ts",
      ["export function getLevel(score: number): string {", '  if (score >= 66) return "HIGH";', '  if (score >= 33) return "MEDIUM";', '  return "LOW";', "}", ""].join("\n"),
    );
    repo.writeFile("src/scoring.spec.ts", 'import { getLevel } from "./scoring";\nit("maps 66 to HIGH", () => { getLevel(66); });\n');
    repo.writeFile(
      "src/opportunities.ts",
      ["export function findOpportunities(input: { brokenLinks: number }) {", "  const findings: string[] = [];", "  return findings;", "}", ""].join("\n"),
    );
    repo.writeFile("src/opportunities.spec.ts", 'import { findOpportunities } from "./opportunities";\nit("returns no findings by default", () => { findOpportunities({ brokenLinks: 0 }); });\n');
    repo.writeFile("src/config.ts", ["export const config = {", "  apiKey: process.env.API_KEY,", "};", ""].join("\n"));
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    repo.writeFile(
      "src/scoring.ts",
      ["export function getLevel(score: number): string {", '  if (score > 66) return "HIGH";', '  if (score >= 33) return "MEDIUM";', '  return "LOW";', "}", ""].join("\n"),
    );
    repo.writeFile(
      "src/opportunities.ts",
      [
        "export function findOpportunities(input: { brokenLinks: number }) {",
        "  const findings: string[] = [];",
        "  if (input.brokenLinks > 0) {",
        '    findings.push("broken links found");',
        "  }",
        "  return findings;",
        "}",
        "",
      ].join("\n"),
    );
    repo.writeFile("src/config.ts", ["export const config = {", '  apiKey: process.env.API_KEY ?? "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",', "};", ""].join("\n"));
    repo.commitAll("feature work replicating the 3 seeded-defect shapes");

    const pkg = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    const rf = readFile(repo.path, "feature");

    const logicFindings = reviewLogic(narrowForLogicReview(pkg));
    const testFindings = reviewTestCoverage(narrowForTestCoverageReview(pkg), rf);
    const securityFindings = reviewSecurity(narrowForSecurityReview(pkg), rf);
    const styleFindings = reviewStyle(narrowForStyleReview(pkg), rf);

    // Logic reviewer: finds the operator flip, and ONLY that.
    expect(logicFindings).toHaveLength(1);
    expect(logicFindings[0]).toMatchObject({ category: "logic-error", severity: "MUST-FIX", file: "src/scoring.ts" });

    // Test-coverage reviewer: finds the untested new branch, and ONLY that.
    expect(testFindings).toHaveLength(1);
    expect(testFindings[0]).toMatchObject({ category: "missing-tests", severity: "SHOULD-FIX", file: "src/opportunities.ts" });

    // Security reviewer: finds the hardcoded credential, and ONLY that.
    expect(securityFindings).toHaveLength(1);
    expect(securityFindings[0]).toMatchObject({ category: "security", severity: "MUST-FIX", file: "src/config.ts" });

    // Style reviewer: nothing meaningfully complex or duplicated was introduced — correctly silent.
    expect(styleFindings).toEqual([]);

    // No reviewer invents a file/line that isn't actually in the diff.
    const changedPaths = new Set(pkg.changedFiles.map((f) => f.path));
    for (const finding of [...logicFindings, ...testFindings, ...securityFindings, ...styleFindings]) {
      expect(changedPaths.has(finding.file)).toBe(true);
    }
  });

  it("stays silent across all four reviewers for an unremarkable, well-tested change", () => {
    repo.writeFile("src/util.ts", "export function double(n: number): number {\n  return n * 2;\n}\n");
    repo.writeFile("src/util.spec.ts", 'import { double } from "./util";\nit("doubles", () => { double(2); });\n');
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    repo.writeFile("src/util.ts", "export function double(n: number): number {\n  return n * 2; // no behavior change, just a comment\n}\n");
    repo.writeFile("src/util.spec.ts", 'import { double } from "./util";\nit("doubles", () => { expect(double(2)).toBe(4); });\n');
    repo.commitAll("trivial, well-tested change");

    const pkg = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    const rf = readFile(repo.path, "feature");

    expect(reviewLogic(narrowForLogicReview(pkg))).toEqual([]);
    expect(reviewTestCoverage(narrowForTestCoverageReview(pkg), rf)).toEqual([]);
    expect(reviewSecurity(narrowForSecurityReview(pkg), rf)).toEqual([]);
    expect(reviewStyle(narrowForStyleReview(pkg), rf)).toEqual([]);
  });
});
