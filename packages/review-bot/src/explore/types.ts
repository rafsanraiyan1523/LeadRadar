/**
 * Explore subagent contracts — see docs/assignment/subagent-architecture.md
 * §1 (Explore subagent) and docs/assignment/explore-subagent.md.
 *
 * Every type here is deliberately fact-only: nothing carries a severity,
 * verdict, or "this is wrong" judgment. That is enforced by construction —
 * there is no field anywhere in this file that a reviewer's severity could
 * be written into.
 */

export interface ExploreInput {
  /** Path to a local git working tree. */
  repoPath: string;
  /** The PR's target branch/ref, e.g. "main". */
  baseRef: string;
  /** The PR's source branch/ref, e.g. "assignment/seeded-defects". Defaults to "HEAD". */
  headRef?: string;
  /** Max lines kept per hunk excerpt before truncation. Default 12. */
  maxHunkExcerptLines?: number;
  /** Max caller files recorded per changed file before truncation. Default 8. */
  maxCallers?: number;
  /** Repo-relative paths never read or searched, regardless of what a diff/grep would otherwise surface. */
  denylistPaths?: string[];
}

export type ChangeKind = "added" | "modified" | "deleted" | "renamed";

export interface ChangedSymbol {
  name: string;
  kind: "function" | "class" | "interface" | "const" | "method" | "unknown";
  /** 1-indexed line the declaration starts on, in the post-change (head) file. */
  line: number;
}

export interface ChangeHunkSummary {
  /** Raw unified-diff hunk header, e.g. "@@ -20,5 +20,5 @@". */
  header: string;
  /** 1-indexed start/end lines this hunk *spans* in the post-change file — often wider than any single changed line (context included). */
  startLine: number;
  endLine: number;
  /** Truncated +/- excerpt — never the full file. */
  excerpt: string;
  truncated: boolean;
  /**
   * The exact post-change line number for each added ("+") line kept in
   * `excerpt`, in the same order they appear there. Lets a reviewer report
   * a precise single-line finding (e.g. "line 22") instead of falling back
   * to this hunk's full startLine-endLine span when only one line actually
   * changed within a wider-context hunk.
   */
  addedLineNumbers: number[];
}

export type TestMatchReason =
  | "co-located-spec"
  | "e2e-suite-reference"
  | "import-reference";

export interface RelevantTestFile {
  path: string;
  changedInDiff: boolean;
  matchedBy: TestMatchReason;
}

export type RiskFlagKind =
  | "security-sensitive-path"
  | "possible-hardcoded-secret"
  | "no-relevant-test-found"
  | "relevant-tests-exist-but-unchanged"
  | "large-diff"
  | "widely-imported-file";

export interface RiskFlag {
  kind: RiskFlagKind;
  /** Neutral, factual description — never a verdict ("this is broken"). */
  description: string;
}

export interface ChangedFileSummary {
  path: string;
  changeKind: ChangeKind;
  /** Set when changeKind is "renamed". */
  renamedFrom?: string;
  linesAdded: number;
  linesRemoved: number;
  /** Mechanically derived from the diff shape — never a judgment about correctness. */
  purpose: string;
  changedSymbols: ChangedSymbol[];
  hunks: ChangeHunkSummary[];
  /** Repo-relative paths of files that import/reference this file's changed symbols. */
  callers: string[];
  relevantTests: RelevantTestFile[];
  /** Plain-language notes on what downstream behavior this change can reach — not a risk verdict. */
  potentiallyAffectedBehavior: string[];
  riskFlags: RiskFlag[];
  /** Things Explore could not determine for this file (truncation, unreadable content, cap hits). */
  missingContext: string[];
}

export interface ExploreContextPackage {
  baseRef: string;
  headRef: string;
  mergeBase: string;
  generatedAt: string;
  changedFiles: ChangedFileSummary[];
  /** Repo-wide gaps or caveats, not tied to one file. */
  globalMissingContext: string[];
  /** One or two mechanically-templated sentences — not an assessment. */
  summary: string;
}
