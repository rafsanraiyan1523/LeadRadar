import { describe, expect, it } from "vitest";
import { computeRiskFlags } from "./risk";

describe("computeRiskFlags", () => {
  it("flags a security-sensitive path", () => {
    const flags = computeRiskFlags({
      path: "apps/api/src/auth/lib/tokens.ts",
      linesAdded: 1,
      linesRemoved: 1,
      hunks: [],
      callers: [],
      relevantTests: [{ path: "apps/api/src/auth/lib/tokens.spec.ts", changedInDiff: true, matchedBy: "co-located-spec" }],
      hasChangedSymbols: true,
    });
    expect(flags.map((f) => f.kind)).toContain("security-sensitive-path");
  });

  it("flags a credential-shaped literal in a hunk excerpt", () => {
    const flags = computeRiskFlags({
      path: "src/config.ts",
      linesAdded: 1,
      linesRemoved: 0,
      hunks: [{ header: "@@", startLine: 1, endLine: 1, excerpt: '+  key: "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",', truncated: false, addedLineNumbers: [1] }],
      callers: [],
      relevantTests: [],
      hasChangedSymbols: false,
    });
    expect(flags.map((f) => f.kind)).toContain("possible-hardcoded-secret");
  });

  it("flags missing test coverage only when the change touches an exported symbol", () => {
    const withSymbol = computeRiskFlags({
      path: "src/thing.ts",
      linesAdded: 1,
      linesRemoved: 0,
      hunks: [],
      callers: [],
      relevantTests: [],
      hasChangedSymbols: true,
    });
    expect(withSymbol.map((f) => f.kind)).toContain("no-relevant-test-found");

    const withoutSymbol = computeRiskFlags({
      path: "src/thing.ts",
      linesAdded: 1,
      linesRemoved: 0,
      hunks: [],
      callers: [],
      relevantTests: [],
      hasChangedSymbols: false,
    });
    expect(withoutSymbol.map((f) => f.kind)).not.toContain("no-relevant-test-found");
  });

  it("distinguishes 'no test found' from 'tests exist but none changed'", () => {
    const flags = computeRiskFlags({
      path: "src/thing.ts",
      linesAdded: 1,
      linesRemoved: 0,
      hunks: [],
      callers: [],
      relevantTests: [{ path: "src/thing.spec.ts", changedInDiff: false, matchedBy: "co-located-spec" }],
      hasChangedSymbols: true,
    });
    expect(flags.map((f) => f.kind)).toContain("relevant-tests-exist-but-unchanged");
    expect(flags.map((f) => f.kind)).not.toContain("no-relevant-test-found");
  });

  it("flags a large diff and a widely-imported file past their thresholds", () => {
    const flags = computeRiskFlags({
      path: "src/thing.ts",
      linesAdded: 100,
      linesRemoved: 60,
      hunks: [],
      callers: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"],
      relevantTests: [],
      hasChangedSymbols: false,
    });
    expect(flags.map((f) => f.kind)).toContain("large-diff");
    expect(flags.map((f) => f.kind)).toContain("widely-imported-file");
  });

  it("never produces a severity or verdict field — only kind + a factual description", () => {
    const flags = computeRiskFlags({
      path: "apps/api/src/auth/lib/tokens.ts",
      linesAdded: 1,
      linesRemoved: 1,
      hunks: [],
      callers: [],
      relevantTests: [],
      hasChangedSymbols: false,
    });
    for (const flag of flags) {
      expect(Object.keys(flag).sort()).toEqual(["description", "kind"]);
    }
  });
});
