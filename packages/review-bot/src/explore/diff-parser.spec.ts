import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./diff-parser";

describe("parseUnifiedDiff", () => {
  it("parses a single hunk's header and +/- lines, dropping context lines", () => {
    const diff = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 1111111..2222222 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -1,4 +1,4 @@",
      " export function foo() {",
      "-  return 1;",
      "+  return 2;",
      " }",
      "",
    ].join("\n");

    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.header).toBe("@@ -1,4 +1,4 @@");
    expect(hunks[0]?.newStart).toBe(1);
    expect(hunks[0]?.newLines).toBe(4);
    expect(hunks[0]?.changedLines).toEqual([
      { text: "-  return 1;", newLine: null },
      { text: "+  return 2;", newLine: 2 },
    ]);
  });

  it("computes the correct post-change line number for an added line deep inside a wide-context hunk", () => {
    // Mirrors DEFECT-1's real shape: a 5-line hunk (context included) where
    // only one line in the middle actually changed.
    const diff = [
      "--- a/src/scoring.ts",
      "+++ b/src/scoring.ts",
      "@@ -20,5 +20,5 @@ const LEGITIMACY_MAX = 40;",
      " ",
      " export function getOpportunityLevel(score: number): OpportunityLevel {",
      '-  if (score >= 66) return "HIGH";',
      '+  if (score > 66) return "HIGH";',
      '   if (score >= 33) return "MEDIUM";',
      "",
    ].join("\n");

    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(1);
    const added = hunks[0]!.changedLines.find((l) => l.text.startsWith("+"));
    // newStart=20; line 20 is blank (context), line 21 is the function
    // signature (context), so the changed line lands on line 22 — not the
    // hunk's own startLine (20).
    expect(added?.newLine).toBe(22);
  });

  it("parses multiple hunks in one file diff independently", () => {
    const diff = [
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -2,2 +2,2 @@",
      "-a",
      "+b",
      "@@ -20,2 +20,2 @@",
      "-c",
      "+d",
      "",
    ].join("\n");

    const hunks = parseUnifiedDiff(diff);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.newStart).toBe(2);
    expect(hunks[1]?.newStart).toBe(20);
  });

  it("returns no hunks for a diff with no @@ markers (e.g. a rename with no content change)", () => {
    const diff = ["diff --git a/old.ts b/new.ts", "similarity index 100%", "rename from old.ts", "rename to new.ts", ""].join("\n");
    expect(parseUnifiedDiff(diff)).toEqual([]);
  });
});
