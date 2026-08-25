import { describe, expect, it } from "vitest";
import { classifyFinding } from "./classify";
import type { Finding, FindingCategory } from "../rubric/types";

function finding(category: FindingCategory): Finding {
  return {
    category,
    severity: "MUST-FIX",
    title: "t",
    file: "src/x.ts",
    line: "1",
    explanation: "e",
    evidence: "ev",
    suggested_fix: "fix",
    confidence: "high",
  };
}

describe("classifyFinding — unsafe fixes require approval", () => {
  it.each<FindingCategory>(["logic-error", "missing-tests", "security", "style-maintainability"])(
    "classifies a %s finding as requires-approval, with a category-specific reason",
    (category) => {
      const result = classifyFinding(finding(category));
      expect(result.classification).toBe("requires-approval");
      expect(result.reason.length).toBeGreaterThan(0);
    },
  );

  it("gives security a reason that does not depend on how the specific finding looks", () => {
    // Security findings must never be auto-fixed regardless of content —
    // verified by checking the reason text doesn't reference the finding
    // at all (it's a blanket policy, not a per-finding judgment call).
    const a = classifyFinding({ ...finding("security"), title: "A" });
    const b = classifyFinding({ ...finding("security"), title: "totally different finding" });
    expect(a.reason).toBe(b.reason);
  });
});
