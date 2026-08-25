import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runExplore } from "../explore/explore";
import { readFileAtRef } from "../explore/git";
import { reviewLogic } from "./logic/logic-reviewer";
import { reviewTestCoverage } from "./test-coverage/test-coverage-reviewer";
import { reviewSecurity } from "./security/security-reviewer";
import { reviewStyle } from "./style/style-reviewer";
import { narrowForLogicReview, narrowForSecurityReview, narrowForStyleReview, narrowForTestCoverageReview } from "./shared/types";

/**
 * Closes the loop from Step 3 through Step 6: runs the actual pipeline
 * (Explore → reviewers) against this repository's real
 * `assignment/seeded-defects` benchmark branch and checks the three known
 * defects are found with the severities recorded in
 * docs/assignment/benchmark-ground-truth.md — not a synthetic fixture, the
 * real seeded commits. This test does not read that ground-truth file
 * (which would defeat its own purpose); expectations are hardcoded here
 * from what Step 3 already established independently.
 *
 * Skips itself (rather than failing) if the branch isn't present in this
 * checkout, since — unlike every other test in this package — it
 * necessarily depends on repository state rather than a hermetic fixture.
 */
const REPO_ROOT = resolve(__dirname, "../../../..");

function branchExists(branch: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", branch], { cwd: REPO_ROOT, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const hasBenchmarkBranch = branchExists("assignment/seeded-defects");

describe.skipIf(!hasBenchmarkBranch)("Explore → reviewers against the real assignment/seeded-defects branch", () => {
  it("finds DEFECT-1 (logic), DEFECT-2 (missing tests), and DEFECT-3 (security), with no unexpected findings", () => {
    const pkg = runExplore({ repoPath: REPO_ROOT, baseRef: "main", headRef: "assignment/seeded-defects" });
    const rf = (path: string) => readFileAtRef(REPO_ROOT, "assignment/seeded-defects", path);

    const logicFindings = reviewLogic(narrowForLogicReview(pkg));
    const testFindings = reviewTestCoverage(narrowForTestCoverageReview(pkg), rf);
    const securityFindings = reviewSecurity(narrowForSecurityReview(pkg), rf);
    const styleFindings = reviewStyle(narrowForStyleReview(pkg), rf);

    // DEFECT-1 — packages/providers/src/audit/opportunity-scoring.ts:22
    const defect1 = logicFindings.find((f) => f.file === "packages/providers/src/audit/opportunity-scoring.ts");
    expect(defect1).toBeDefined();
    expect(defect1?.severity).toBe("MUST-FIX");
    expect(defect1?.line).toBe("22");

    // DEFECT-2 — packages/providers/src/audit/growth-opportunities.ts:106-114
    const defect2 = testFindings.find((f) => f.file === "packages/providers/src/audit/growth-opportunities.ts");
    expect(defect2).toBeDefined();
    expect(defect2?.severity).toBe("SHOULD-FIX");

    // DEFECT-3 — apps/worker/src/config/env.ts:18-21
    const defect3 = securityFindings.find((f) => f.file === "apps/worker/src/config/env.ts");
    expect(defect3).toBeDefined();
    expect(defect3?.severity).toBe("MUST-FIX");
    expect(defect3?.evidence).toContain("AIzaSy");

    // Exactly one finding per category — this diff shouldn't trip anything else.
    expect(logicFindings).toHaveLength(1);
    expect(testFindings).toHaveLength(1);
    expect(securityFindings).toHaveLength(1);
    // Lint was verified clean on this branch in Step 3, and no complexity/
    // duplication was introduced — Style should correctly stay silent.
    expect(styleFindings).toEqual([]);
  });
});
