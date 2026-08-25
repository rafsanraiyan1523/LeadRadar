import type { Finding } from "../../rubric/types";
import type { TestCoverageReviewFile, TestCoverageReviewInput } from "../shared/types";
import { addedLines, lineRangeLabel, removedLines } from "../shared/hunk-text";

/**
 * Test-coverage reviewer — rubric Category 2. Explicitly conservative per
 * the rubric and Step 6 instructions: it never fires just because a
 * function has no test ("do NOT complain merely because every function
 * lacks a test") — every detector below requires a specific, meaningful
 * trigger (a new branch, a function/class-level change, or a test file
 * that was touched but doesn't mention what changed), not bare absence.
 */

const BRANCH_KEYWORD = /\b(if|else if|switch|catch)\s*[( ]/;

function hasFunctionLikeSymbol(file: TestCoverageReviewFile): boolean {
  return file.changedSymbols.some((s) => s.kind === "function" || s.kind === "class" || s.kind === "method");
}

/** Detector 1 — a new branch added to code that has an existing (but untouched) test file. */
function detectNewBranchWithoutTestUpdate(file: TestCoverageReviewFile): Finding | null {
  if (!hasFunctionLikeSymbol(file)) return null;
  const hasUntouchedRelevantTest = file.relevantTests.length > 0 && !file.relevantTests.some((t) => t.changedInDiff);
  if (!hasUntouchedRelevantTest) return null;

  for (const hunk of file.hunks) {
    // Require the branch keyword to be genuinely new in this hunk — a line
    // that merely modifies an existing `if (...)`'s condition (e.g. a
    // changed comparison) still contains "if (" in both the removed and
    // added text, and is not a *new* branch. Requiring absence from the
    // removed lines keeps this conservative rather than firing on any edit
    // to an existing conditional.
    const hunkHadBranchKeywordBefore = removedLines(hunk).some((l) => BRANCH_KEYWORD.test(l));
    if (hunkHadBranchKeywordBefore) continue;
    const newBranchLine = addedLines(hunk).find((l) => BRANCH_KEYWORD.test(l));
    if (!newBranchLine) continue;

    const symbolNames = file.changedSymbols.map((s) => s.name).join(", ") || "the changed code";
    const testPaths = file.relevantTests.map((t) => t.path).join(", ");
    return {
      category: "missing-tests",
      severity: "SHOULD-FIX",
      title: `New conditional branch added to ${symbolNames}, but its existing test file wasn't updated`,
      file: file.path,
      line: lineRangeLabel(hunk.startLine, hunk.endLine),
      explanation:
        `This hunk adds a new branch (\`${newBranchLine.trim()}\`) inside code covered by ${testPaths}, but that test file did not change ` +
        "in this diff. The existing suite may still pass without ever exercising this new branch.",
      evidence: newBranchLine.trim(),
      suggested_fix: `Add a case to ${testPaths} that exercises this new branch and asserts its output.`,
      confidence: "high",
    };
  }
  return null;
}

/** Detector 2 — a meaningful function/class-level change with no relevant test found at all. */
function detectNoTestCoverage(file: TestCoverageReviewFile): Finding | null {
  if (!hasFunctionLikeSymbol(file)) return null;
  if (file.relevantTests.length > 0) return null;
  if (file.linesAdded + file.linesRemoved < 2) return null; // skip trivial one-line tweaks

  const symbolNames = file.changedSymbols.map((s) => s.name).join(", ");
  const firstHunk = file.hunks[0];
  return {
    category: "missing-tests",
    severity: "SHOULD-FIX",
    title: `No test file found for changed ${symbolNames}`,
    file: file.path,
    line: firstHunk ? lineRangeLabel(firstHunk.startLine, firstHunk.endLine) : "1",
    explanation:
      `${symbolNames} changed in this PR (+${file.linesAdded}/-${file.linesRemoved} lines), and no co-located spec, e2e reference, ` +
      "or import-reference test file was found anywhere in the repository for it.",
    evidence: `Changed symbol(s): ${symbolNames}; no matching test file found.`,
    suggested_fix: `Add a test file covering ${symbolNames}'s new/changed behavior.`,
    confidence: "medium",
  };
}

/**
 * Detector 3 — a test file WAS changed in this diff, but its content
 * doesn't mention a symbol this PR changed in the corresponding source
 * file. Requires reading the (already-identified, already-changed) test
 * file's content — a narrow, on-demand capability, not open-ended repo
 * access: this only ever reads a path Explore already told this reviewer
 * is relevant.
 */
function detectUnverifiedTestUpdate(
  file: TestCoverageReviewFile,
  readFile: (path: string) => string | null,
): Finding | null {
  if (file.changedSymbols.length === 0) return null;

  for (const test of file.relevantTests) {
    if (!test.changedInDiff) continue;
    const content = readFile(test.path);
    if (content === null) continue;

    const unmentioned = file.changedSymbols.filter((s) => !content.includes(s.name));
    if (unmentioned.length === 0) continue;
    // Only flag when NONE of the changed symbols are mentioned — if some
    // are covered and one isn't, that's a much weaker signal we'd rather
    // not speculate about.
    if (unmentioned.length !== file.changedSymbols.length) continue;

    const names = unmentioned.map((s) => s.name).join(", ");
    return {
      category: "missing-tests",
      severity: "SHOULD-FIX",
      title: `${test.path} was updated but doesn't reference ${names}`,
      file: file.path,
      line: lineRangeLabel(file.hunks[0]?.startLine ?? 1, file.hunks[0]?.endLine ?? 1),
      explanation:
        `${test.path} changed in this PR, but its content has no reference to ${names}, which this PR changed in ${file.path}. ` +
        "The test update may be unrelated to this change, or the new/changed behavior may not actually be exercised.",
      evidence: `${names} not found anywhere in ${test.path}'s content.`,
      suggested_fix: `Verify ${test.path} actually exercises ${names}'s new behavior, or add a case that does.`,
      confidence: "medium",
    };
  }
  return null;
}

export function reviewTestCoverage(
  input: TestCoverageReviewInput,
  readFile: (path: string) => string | null = () => null,
): Finding[] {
  const findings: Finding[] = [];
  for (const file of input.files) {
    if (file.changeKind === "deleted") continue;

    const branchFinding = detectNewBranchWithoutTestUpdate(file);
    if (branchFinding) {
      findings.push(branchFinding);
      continue; // avoid also emitting detector 2 for the same file — see reviewers doc on avoiding self-duplication
    }

    const noTestFinding = detectNoTestCoverage(file);
    if (noTestFinding) {
      findings.push(noTestFinding);
      continue;
    }

    const unverified = detectUnverifiedTestUpdate(file, readFile);
    if (unverified) findings.push(unverified);
  }
  return findings;
}
