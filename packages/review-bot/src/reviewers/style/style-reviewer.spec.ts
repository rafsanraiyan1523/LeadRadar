import { describe, expect, it } from "vitest";
import { reviewStyle } from "./style-reviewer";
import type { StyleReviewInput } from "../shared/types";
import type { ChangeHunkSummary } from "../../explore/types";

function hunk(overrides: Partial<ChangeHunkSummary> & { excerpt: string }): ChangeHunkSummary {
  const base: ChangeHunkSummary = { header: "@@", startLine: 1, endLine: 1, truncated: false, addedLineNumbers: [], ...overrides };
  if (!overrides.addedLineNumbers) {
    const addedCount = base.excerpt.split("\n").filter((l) => l.startsWith("+")).length;
    base.addedLineNumbers = Array.from({ length: addedCount }, (_, i) => base.startLine + i);
  }
  return base;
}

function fileInput(hunks: ChangeHunkSummary[], path = "src/thing.ts"): StyleReviewInput {
  return { files: [{ path, changeKind: "modified", linesAdded: hunks.length, linesRemoved: 0, hunks, changedSymbols: [] }] };
}

describe("reviewStyle — complexity growth", () => {
  it("flags a deeply nested added line", () => {
    const deep = "+" + " ".repeat(14) + "doSomething();";
    const findings = reviewStyle(fileInput([hunk({ excerpt: deep })]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "style-maintainability", severity: "SHOULD-FIX" });
  });

  it("does not flag ordinary, shallow indentation", () => {
    const findings = reviewStyle(fileInput([hunk({ excerpt: "+  const x = 1;\n+  return x;" })]));
    expect(findings).toEqual([]);
  });

  it("flags a very large single-hunk addition", () => {
    const lines = Array.from({ length: 65 }, (_, i) => `+  const v${i} = ${i};`).join("\n");
    const findings = reviewStyle(fileInput([hunk({ excerpt: lines })]));
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toContain("Large block");
  });

  it("does not flag a moderately sized addition under the threshold", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `+  const v${i} = ${i};`).join("\n");
    const findings = reviewStyle(fileInput([hunk({ excerpt: lines })]));
    expect(findings).toEqual([]);
  });
});

describe("reviewStyle — within-file duplication", () => {
  const existingBlock = [
    "function existingHelper() {",
    "  const a = fetchSomething();",
    "  const b = transform(a);",
    "  const c = validate(b);",
    "  return finalize(c);",
    "  logCompletion();",
    "}",
  ].join("\n");

  const addedDuplicate = [
    "+  const a = fetchSomething();",
    "+  const b = transform(a);",
    "+  const c = validate(b);",
    "+  return finalize(c);",
    "+  logCompletion();",
  ].join("\n");

  it("does not flag duplication when no file content is available (must not speculate)", () => {
    const findings = reviewStyle(fileInput([hunk({ excerpt: addedDuplicate })], "src/dup.ts"));
    expect(findings).toEqual([]);
  });

  it("flags duplication when file content is available and the block truly repeats", () => {
    const fullFile = `${existingBlock}\n\nfunction newOne() {\n  const a = fetchSomething();\n  const b = transform(a);\n  const c = validate(b);\n  return finalize(c);\n  logCompletion();\n}\n`;
    const withReadFile = reviewStyleWithReadFile(fileInput([hunk({ excerpt: addedDuplicate })], "src/dup.ts"), fullFile);
    expect(withReadFile).toHaveLength(1);
    expect(withReadFile[0]).toMatchObject({ category: "style-maintainability", severity: "SHOULD-FIX" });
  });

  it("does not flag a short added block even if it repeats (below the minimum line/char threshold)", () => {
    const shortDuplicate = "+  }\n+}\n+export default X;";
    const fullFile = "  }\n}\nexport default X;\n\n  }\n}\nexport default X;\n";
    const withReadFile = reviewStyleWithReadFile(fileInput([hunk({ excerpt: shortDuplicate })], "src/short.ts"), fullFile);
    expect(withReadFile).toEqual([]);
  });

  it("does not flag when the added block appears only once in the file (itself) — i.e. genuinely new code", () => {
    const uniqueBlock = ["+  const q = uniqueOperationOne();", "+  const w = uniqueOperationTwo();", "+  const e = uniqueOperationThree();", "+  const r = uniqueOperationFour();", "+  return q + w + e + r;"].join("\n");
    const fullFile = [
      "function uniqueOne() {",
      "  const q = uniqueOperationOne();",
      "  const w = uniqueOperationTwo();",
      "  const e = uniqueOperationThree();",
      "  const r = uniqueOperationFour();",
      "  return q + w + e + r;",
      "}",
    ].join("\n");
    const withReadFile = reviewStyleWithReadFile(fileInput([hunk({ excerpt: uniqueBlock })], "src/unique.ts"), fullFile);
    expect(withReadFile).toEqual([]);
  });
});

/** Derives the readFile path from the input itself, so it's structurally impossible for the two to drift apart. */
function reviewStyleWithReadFile(input: StyleReviewInput, content: string) {
  const path = input.files[0]?.path;
  return reviewStyle(input, (p) => (p === path ? content : null));
}

describe("reviewStyle — conservatism", () => {
  it("produces no findings for an unremarkable, small change", () => {
    const findings = reviewStyle(fileInput([hunk({ excerpt: "+  const label = formatLabel(name);" })]));
    expect(findings).toEqual([]);
  });

  it("skips deleted files", () => {
    const findings = reviewStyle({
      files: [{ path: "src/gone.ts", changeKind: "deleted", linesAdded: 0, linesRemoved: 5, hunks: [hunk({ excerpt: "-  const x = 1;" })], changedSymbols: [] }],
    });
    expect(findings).toEqual([]);
  });

  it("every finding includes all required rubric fields", () => {
    const deep = "+" + " ".repeat(14) + "doSomething();";
    const findings = reviewStyle(fileInput([hunk({ excerpt: deep })]));
    for (const field of ["category", "severity", "title", "file", "line", "explanation", "evidence", "suggested_fix", "confidence"]) {
      expect(findings[0]).toHaveProperty(field);
    }
  });
});
