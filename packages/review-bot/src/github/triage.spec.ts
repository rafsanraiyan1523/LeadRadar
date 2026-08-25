import { describe, expect, it } from "vitest";
import { planLabelChanges, triagePR } from "./triage";
import { TRIAGE_LABELS } from "./types";
import type { NormalizedFinding } from "../pipeline/types";

function finding(severity: NormalizedFinding["severity"]): NormalizedFinding {
  return {
    id: "F1",
    source: "logic",
    category: "logic-error",
    severity,
    title: "t",
    file: "src/x.ts",
    line: "1",
    explanation: "e",
    evidence: "ev",
    suggested_fix: "fix",
    confidence: "high",
  };
}

describe("triagePR — severity classification", () => {
  it("labels a PR with any MUST-FIX finding as must-fix, even alongside SHOULD-FIX findings", () => {
    expect(triagePR([finding("SHOULD-FIX"), finding("MUST-FIX")])).toBe(TRIAGE_LABELS.mustFix);
  });

  it("labels a PR with only SHOULD-FIX findings as should-fix", () => {
    expect(triagePR([finding("SHOULD-FIX")])).toBe(TRIAGE_LABELS.shouldFix);
  });

  it("labels a PR with no findings as clean", () => {
    expect(triagePR([])).toBe(TRIAGE_LABELS.clean);
  });
});

describe("planLabelChanges — label/triage behavior", () => {
  it("adds the target label when none of the triage labels are present yet", () => {
    const plan = planLabelChanges(["unrelated-label"], TRIAGE_LABELS.mustFix);
    expect(plan.toAdd).toEqual([TRIAGE_LABELS.mustFix]);
    expect(plan.toRemove).toEqual([]);
  });

  it("removes the stale triage label when the PR improves from must-fix to clean", () => {
    const plan = planLabelChanges([TRIAGE_LABELS.mustFix, "unrelated-label"], TRIAGE_LABELS.clean);
    expect(plan.toAdd).toEqual([TRIAGE_LABELS.clean]);
    expect(plan.toRemove).toEqual([TRIAGE_LABELS.mustFix]);
  });

  it("does nothing when the correct label is already the only one present", () => {
    const plan = planLabelChanges([TRIAGE_LABELS.shouldFix], TRIAGE_LABELS.shouldFix);
    expect(plan.toAdd).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it("never touches a label this bot doesn't own", () => {
    const plan = planLabelChanges(["needs-triage", "good-first-issue"], TRIAGE_LABELS.mustFix);
    expect(plan.toRemove).toEqual([]);
    expect(plan.toAdd).toEqual([TRIAGE_LABELS.mustFix]);
  });
});
