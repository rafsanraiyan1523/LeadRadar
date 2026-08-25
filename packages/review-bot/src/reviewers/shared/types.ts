import type { ChangedFileSummary, ExploreContextPackage } from "../../explore/types";

/**
 * Per-reviewer input shapes, each a strict TS `Pick` over
 * `ChangedFileSummary` — a type-level enforcement of "only the source/diff
 * context necessary for its responsibility" (Step 6 instructions). A
 * reviewer's function signature makes it impossible to accidentally read a
 * field outside its remit (e.g. the Style reviewer's input type has no
 * `relevantTests` field to reach for), independent of what the function
 * body happens to do.
 */

export type LogicReviewFile = Pick<ChangedFileSummary, "path" | "changeKind" | "linesAdded" | "linesRemoved" | "hunks" | "changedSymbols">;
export interface LogicReviewInput {
  files: LogicReviewFile[];
}

export type TestCoverageReviewFile = Pick<
  ChangedFileSummary,
  "path" | "changeKind" | "linesAdded" | "linesRemoved" | "hunks" | "changedSymbols" | "relevantTests"
>;
export interface TestCoverageReviewInput {
  files: TestCoverageReviewFile[];
}

export type SecurityReviewFile = Pick<ChangedFileSummary, "path" | "changeKind" | "linesAdded" | "linesRemoved" | "hunks" | "changedSymbols">;
export interface SecurityReviewInput {
  files: SecurityReviewFile[];
}

export type StyleReviewFile = Pick<ChangedFileSummary, "path" | "changeKind" | "linesAdded" | "linesRemoved" | "hunks" | "changedSymbols">;
export interface StyleReviewInput {
  files: StyleReviewFile[];
}

function pickCommon(f: ChangedFileSummary) {
  return {
    path: f.path,
    changeKind: f.changeKind,
    linesAdded: f.linesAdded,
    linesRemoved: f.linesRemoved,
    hunks: f.hunks,
    changedSymbols: f.changedSymbols,
  };
}

export function narrowForLogicReview(pkg: ExploreContextPackage): LogicReviewInput {
  return { files: pkg.changedFiles.map(pickCommon) };
}

export function narrowForTestCoverageReview(pkg: ExploreContextPackage): TestCoverageReviewInput {
  return { files: pkg.changedFiles.map((f) => ({ ...pickCommon(f), relevantTests: f.relevantTests })) };
}

export function narrowForSecurityReview(pkg: ExploreContextPackage): SecurityReviewInput {
  return { files: pkg.changedFiles.map(pickCommon) };
}

export function narrowForStyleReview(pkg: ExploreContextPackage): StyleReviewInput {
  return { files: pkg.changedFiles.map(pickCommon) };
}
