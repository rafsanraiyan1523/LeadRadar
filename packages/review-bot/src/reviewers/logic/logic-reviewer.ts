import type { Finding } from "../../rubric/types";
import type { LogicReviewFile, LogicReviewInput } from "../shared/types";
import { addedLines, lineRangeLabel, removedLines } from "../shared/hunk-text";
import type { ChangeHunkSummary } from "../../explore/types";

/**
 * Logic reviewer — rubric Category 1 (docs/assignment/review-rubric.md).
 *
 * Deliberately narrow: two precise, high-precision detectors rather than a
 * broad "does this look wrong" pass. Each one only fires on a concrete,
 * quotable textual pattern actually present in the diff — never a guess
 * about intent. This is what makes "a finding requires evidence" and "no
 * invented files or lines" true by construction: there is no code path in
 * this module that produces a Finding without a literal line from a real
 * hunk backing it.
 */

const COMPARISON = /([A-Za-z_$][\w.$]*)\s*(>=|<=|===|!==|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)/;

function parseComparison(line: string): { left: string; op: string; right: string } | null {
  const match = COMPARISON.exec(line);
  if (!match) return null;
  return { left: match[1]!, op: match[2]!, right: match[3]! };
}

/**
 * Detector 1 — comparison operator flipped on an otherwise-identical
 * numeric threshold check (e.g. `score >= 66` → `score > 66`). Only fires
 * on a hunk with exactly one removed and one added line, so the pairing is
 * unambiguous — this is deliberately conservative rather than trying to
 * pair operators across a noisier multi-line hunk.
 */
function detectComparisonOperatorFlip(file: LogicReviewFile, hunk: ChangeHunkSummary): Finding | null {
  const removed = removedLines(hunk);
  const added = addedLines(hunk);
  if (removed.length !== 1 || added.length !== 1) return null;

  const before = parseComparison(removed[0]!);
  const after = parseComparison(added[0]!);
  if (!before || !after) return null;
  if (before.left !== after.left || before.right !== after.right) return null;
  if (before.op === after.op) return null;

  return {
    category: "logic-error",
    severity: "MUST-FIX",
    title: `Comparison operator changed on an existing threshold check (${before.op} → ${after.op})`,
    file: file.path,
    // The specific changed line, not the hunk's whole (often wider,
    // context-inclusive) span — precise per the rubric's "smallest span
    // that demonstrates the issue" rule. Guaranteed present: exactly one
    // added line got us here.
    line: lineRangeLabel(hunk.addedLineNumbers[0]!, hunk.addedLineNumbers[0]!),
    explanation:
      `The comparison \`${before.left} ${before.op} ${before.right}\` was changed to \`${after.left} ${after.op} ${after.right}\` — ` +
      `every other part of the line is unchanged, so this is specifically a boundary/inclusivity change. A value of exactly ${before.right} ` +
      `now evaluates differently than it did before this change, which silently reclassifies that boundary case.`,
    evidence: `- ${removed[0]!.trim()}\n+ ${added[0]!.trim()}`,
    suggested_fix: `Confirm which boundary behavior is intended for ${before.left} === ${before.right}. If the previous behavior (\`${before.op}\`) was correct, revert this operator; if not, add/update a test asserting the new boundary explicitly.`,
    confidence: "high",
  };
}

const LENGTH_OFF_BY_ONE = /<=\s*[\w.$]+\.length\b/;

/**
 * Detector 2 — a newly-added `<= x.length` comparison, the classic
 * off-by-one shape (`arr[arr.length]` is out of bounds). Only fires when
 * the pattern is new in this hunk (absent from the removed lines) — pattern
 * merely being retained/reformatted is not this PR's doing.
 */
function detectLengthOffByOne(file: LogicReviewFile, hunk: ChangeHunkSummary): Finding | null {
  const added = addedLines(hunk);
  const removedText = removedLines(hunk).join("\n");
  const matchLine = added.find((l) => LENGTH_OFF_BY_ONE.test(l) && !LENGTH_OFF_BY_ONE.test(removedText));
  if (!matchLine) return null;

  return {
    category: "logic-error",
    severity: "SHOULD-FIX",
    title: "Possible off-by-one: `<=` compared against `.length`",
    file: file.path,
    line: lineRangeLabel(hunk.startLine, hunk.endLine),
    explanation:
      "A newly-added comparison uses `<=` against a `.length` value. Since valid indices run from 0 to length-1, `<=` here " +
      "typically allows one iteration/access past the end of the array (index === length), which is out of bounds.",
    evidence: matchLine.trim(),
    suggested_fix: "Use `<` instead of `<=` unless there's a specific, intentional reason to include the length-th index (e.g. an insertion-point loop) — if intentional, a short comment would help the next reader.",
    confidence: "medium",
  };
}

const DETECTORS = [detectComparisonOperatorFlip, detectLengthOffByOne];

export function reviewLogic(input: LogicReviewInput): Finding[] {
  const findings: Finding[] = [];
  for (const file of input.files) {
    if (file.changeKind === "deleted") continue;
    for (const hunk of file.hunks) {
      for (const detector of DETECTORS) {
        const finding = detector(file, hunk);
        if (finding) findings.push(finding);
      }
    }
  }
  return findings;
}
