import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runExplore } from "./explore";
import { TempRepo } from "./test-support/temp-repo";

let repo: TempRepo;

beforeEach(() => {
  repo = TempRepo.create();
});

afterEach(() => {
  repo.cleanup();
});

describe("runExplore — changed file identification", () => {
  it("correctly identifies added, modified, and deleted files, and ignores untouched ones", () => {
    repo.writeFile("src/fileA.ts", "export const a = 1;\n");
    repo.writeFile("src/fileB.ts", "export const b = 1;\n");
    repo.writeFile("src/untouched.ts", "export const u = 1;\n");
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    repo.writeFile("src/fileA.ts", "export const a = 2;\n");
    repo.writeFile("src/fileC.ts", "export const c = 1;\n");
    repo.git(["rm", "src/fileB.ts"]);
    repo.commitAll("feature work");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });

    const byPath = Object.fromEntries(result.changedFiles.map((f) => [f.path, f]));
    expect(Object.keys(byPath).sort()).toEqual(["src/fileA.ts", "src/fileB.ts", "src/fileC.ts"]);
    expect(byPath["src/fileA.ts"]?.changeKind).toBe("modified");
    expect(byPath["src/fileB.ts"]?.changeKind).toBe("deleted");
    expect(byPath["src/fileC.ts"]?.changeKind).toBe("added");
    // The untouched file must never appear — this is the "correctly identified" bar, not just "some files found".
    expect(byPath["src/untouched.ts"]).toBeUndefined();
  });

  it("diffs against the merge-base, not baseRef's current tip", () => {
    repo.writeFile("src/shared.ts", "export const shared = 1;\n");
    repo.commitAll("base");
    repo.checkoutNewBranch("feature");
    repo.writeFile("src/feature-only.ts", "export const f = 1;\n");
    repo.commitAll("feature work");

    // main moves on after the branch point — this must NOT show up as a "change" from feature's perspective.
    repo.checkout("main");
    repo.writeFile("src/main-only.ts", "export const m = 1;\n");
    repo.commitAll("main moved on");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    const paths = result.changedFiles.map((f) => f.path);
    expect(paths).toEqual(["src/feature-only.ts"]);
  });
});

describe("runExplore — structured output", () => {
  it("returns a well-formed, JSON-serializable structure with every required field present", () => {
    repo.writeFile("src/thing.ts", "export function thing() {\n  return 1;\n}\n");
    repo.commitAll("base");
    repo.checkoutNewBranch("feature");
    repo.writeFile("src/thing.ts", "export function thing() {\n  return 2;\n}\n");
    repo.commitAll("change it");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });

    // Round-trips cleanly through JSON — no functions, symbols, or undefined leaking through the contract.
    const roundTripped = JSON.parse(JSON.stringify(result));
    expect(roundTripped).toEqual(result);

    expect(result).toHaveProperty("baseRef");
    expect(result).toHaveProperty("headRef");
    expect(result).toHaveProperty("mergeBase");
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("globalMissingContext");
    expect(Array.isArray(result.changedFiles)).toBe(true);

    const file = result.changedFiles[0];
    expect(file).toBeDefined();
    for (const key of [
      "path",
      "changeKind",
      "linesAdded",
      "linesRemoved",
      "purpose",
      "changedSymbols",
      "hunks",
      "callers",
      "relevantTests",
      "potentiallyAffectedBehavior",
      "riskFlags",
      "missingContext",
    ]) {
      expect(file).toHaveProperty(key);
    }
  });

  it("never emits a severity/verdict — Explore reports facts, not findings", () => {
    repo.writeFile("apps/api/src/auth/lib/tokens.ts", 'export const secret = "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000";\n');
    repo.commitAll("base");
    repo.checkoutNewBranch("feature");
    repo.writeFile("apps/api/src/auth/lib/tokens.ts", 'export const secret = "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00001";\n');
    repo.commitAll("touch a security-sensitive file");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    const serialized = JSON.stringify(result);

    // The rubric's severity vocabulary must never appear — Explore has no
    // field to put a severity in, and this asserts nothing smuggles it into
    // a free-text field either (requirement: "avoid making review findings itself").
    expect(serialized).not.toMatch(/MUST-FIX|SHOULD-FIX/);
    expect(result.changedFiles[0]?.riskFlags.some((f) => f.kind === "security-sensitive-path")).toBe(true);
    expect(result.changedFiles[0]?.riskFlags.some((f) => f.kind === "possible-hardcoded-secret")).toBe(true);
  });
});

describe("runExplore — large files are summarized, not dumped", () => {
  it("truncates an oversized hunk and never includes the untouched surrounding file content", () => {
    const fillerLines = Array.from({ length: 300 }, (_, i) => `const filler_${i + 1} = ${i + 1};`);
    repo.writeFile("src/big.ts", `${fillerLines.join("\n")}\n`);
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    const newLines = Array.from({ length: 30 }, (_, i) => `const newLine_${i + 1} = ${i + 1};`);
    const changed = [...fillerLines.slice(0, 150), ...newLines, ...fillerLines.slice(150)];
    repo.writeFile("src/big.ts", `${changed.join("\n")}\n`);
    repo.commitAll("insert a big block");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature", maxHunkExcerptLines: 10 });
    const file = result.changedFiles.find((f) => f.path === "src/big.ts");
    expect(file).toBeDefined();
    expect(file?.hunks.length).toBeGreaterThan(0);

    const hunk = file!.hunks[0]!;
    expect(hunk.truncated).toBe(true);
    // The kept window includes the earliest added lines...
    expect(hunk.excerpt).toContain("newLine_1");
    // ...but the excerpt was actually cut, not just short by luck — later
    // added lines beyond the cap must be gone, not silently included.
    expect(hunk.excerpt).not.toContain("newLine_30");
    expect(hunk.excerpt.split("\n").length).toBeLessThanOrEqual(11); // 10 kept lines + 1 "omitted" notice

    // The strongest form of "not dumped": untouched content far from the
    // change never appears anywhere in the whole serialized output.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("filler_299");
    expect(serialized.length).toBeLessThan(fillerLines.join("\n").length);
  });
});

describe("runExplore — relevant context is retained", () => {
  it("finds a caller (via reference) and a co-located test for a changed function", () => {
    repo.writeFile("src/mathUtils.ts", "export function addNumbers(a: number, b: number): number {\n  return a + b;\n}\n");
    repo.writeFile(
      "src/consumer.ts",
      'import { addNumbers } from "./mathUtils";\n\nexport function sumAll(list: number[]): number {\n  return list.reduce((acc, n) => addNumbers(acc, n), 0);\n}\n',
    );
    repo.writeFile(
      "src/mathUtils.spec.ts",
      'import { addNumbers } from "./mathUtils";\nit("adds", () => { addNumbers(1, 2); });\n',
    );
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    repo.writeFile(
      "src/mathUtils.ts",
      "export function addNumbers(a: number, b: number): number {\n  if (a < 0 || b < 0) throw new Error('no negatives');\n  return a + b;\n}\n",
    );
    repo.commitAll("add validation to addNumbers");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    const file = result.changedFiles.find((f) => f.path === "src/mathUtils.ts");
    expect(file).toBeDefined();

    expect(file?.changedSymbols).toEqual([{ name: "addNumbers", kind: "function", line: 1 }]);
    expect(file?.callers).toContain("src/consumer.ts");

    const test = file?.relevantTests.find((t) => t.path === "src/mathUtils.spec.ts");
    expect(test).toBeDefined();
    expect(test?.matchedBy).toBe("co-located-spec");
    expect(test?.changedInDiff).toBe(false); // the spec file itself was NOT touched by this PR — a fact Explore must retain, not lose.

    expect(file?.potentiallyAffectedBehavior.join(" ")).toContain("src/consumer.ts");
  });

  it("flags an important change with no relevant test found at all", () => {
    repo.writeFile("src/orphan.ts", "export function orphanFn(): number {\n  return 1;\n}\n");
    repo.commitAll("base");
    repo.checkoutNewBranch("feature");
    repo.writeFile("src/orphan.ts", "export function orphanFn(): number {\n  return 2;\n}\n");
    repo.commitAll("change orphan, still no tests");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });
    const file = result.changedFiles.find((f) => f.path === "src/orphan.ts");
    expect(file?.relevantTests).toEqual([]);
    expect(file?.riskFlags.some((f) => f.kind === "no-relevant-test-found")).toBe(true);
  });
});

describe("runExplore — denylist / ground-truth isolation", () => {
  it("never surfaces a denylisted path as a caller, test, or changed file", () => {
    repo.writeFile("src/target.ts", "export function target(): number {\n  return 1;\n}\n");
    repo.writeFile("docs/assignment/benchmark-ground-truth.md", "target target target — ground truth content\n");
    repo.commitAll("base");

    repo.checkoutNewBranch("feature");
    repo.writeFile("src/target.ts", "export function target(): number {\n  return 2;\n}\n");
    // Simulate the ground-truth doc also referencing the symbol name, to
    // prove exclusion is enforced even when it WOULD otherwise match.
    repo.writeFile("docs/assignment/benchmark-ground-truth.md", "target target target — updated ground truth content\n");
    repo.commitAll("change target and (accidentally, for this test) touch ground truth");

    const result = runExplore({ repoPath: repo.path, baseRef: "main", headRef: "feature" });

    expect(result.changedFiles.some((f) => f.path === "docs/assignment/benchmark-ground-truth.md")).toBe(false);
    const target = result.changedFiles.find((f) => f.path === "src/target.ts");
    expect(target?.callers).not.toContain("docs/assignment/benchmark-ground-truth.md");
    expect(JSON.stringify(result)).not.toContain("ground truth content");
  });
});
