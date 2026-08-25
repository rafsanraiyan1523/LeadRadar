import { describe, expect, it } from "vitest";
import { renderFailureComment, renderMalformedOutputComment, renderReviewComment } from "./render";
import { REVIEW_COMMENT_MARKER } from "./types";
import type { NormalizedFinding } from "../pipeline/types";

function finding(overrides: Partial<NormalizedFinding> = {}): NormalizedFinding {
  return {
    id: "F1",
    source: "logic",
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

describe("renderReviewComment", () => {
  it("always includes the dedup marker, so planComment can find it on a later run", () => {
    expect(renderReviewComment([])).toContain(REVIEW_COMMENT_MARKER);
    expect(renderReviewComment([finding()])).toContain(REVIEW_COMMENT_MARKER);
  });

  it("reports a clean PR clearly when there are no findings", () => {
    const body = renderReviewComment([]);
    expect(body).toMatch(/no issues found/i);
  });

  it("groups MUST-FIX ahead of SHOULD-FIX, and includes every finding's file/line/evidence", () => {
    const must = finding({ severity: "MUST-FIX", file: "src/a.ts", line: "1" });
    const should = finding({ severity: "SHOULD-FIX", file: "src/b.ts", line: "2" });
    const body = renderReviewComment([should, must]);

    expect(body.indexOf("MUST-FIX")).toBeLessThan(body.indexOf("SHOULD-FIX"));
    expect(body).toContain("src/a.ts:1");
    expect(body).toContain("src/b.ts:2");
  });
});

describe("renderFailureComment / renderMalformedOutputComment", () => {
  it("never includes raw findings data — only a generic, safe message", () => {
    const body = renderFailureComment("https://example.test/run/1");
    expect(body).toContain(REVIEW_COMMENT_MARKER);
    expect(body).toMatch(/could not complete/i);
    expect(body).not.toMatch(/MUST-FIX|SHOULD-FIX/);
  });

  it("reports the validation failure reason without pretending findings were posted", () => {
    const body = renderMalformedOutputComment('Finding[0] is missing required non-empty string field "file"');
    expect(body).toContain(REVIEW_COMMENT_MARKER);
    expect(body).toContain("could not be read");
  });
});
