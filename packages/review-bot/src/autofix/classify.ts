import type { Finding, FindingCategory } from "../rubric/types";

export type FixClassification = "auto-fixable" | "requires-approval";

/**
 * Why every reviewer-produced finding requires human approval today — one
 * reason per category, not a blanket "because we said so". See
 * docs/assignment/autofix-and-triage.md for the full policy.
 */
const APPROVAL_REASON: Record<FindingCategory, string> = {
  "logic-error":
    "Fixing a logic error requires knowing the *intended* behavior (e.g. which comparison boundary was meant) — that is business-logic judgment, explicitly excluded from auto-fix.",
  "missing-tests":
    "Writing a test that locks in current behavior is only safe if that behavior is actually correct — auto-generating one would risk codifying a bug as \"expected\", which is ambiguous, not mechanical.",
  security:
    "Security findings are never auto-fixed, full stop — per policy, regardless of how simple the apparent fix looks.",
  "style-maintainability":
    "The current detectors (complexity growth, duplication) identify a problem but not a safe mechanical rewrite — extracting a function or renaming something requires a human's naming/design judgment.",
};

/**
 * Classifies a single reviewer finding for the auto-fix policy. This is
 * intentionally NOT a per-finding heuristic that tries to guess "is this
 * one safe" — every reviewer-produced finding is classified the same way
 * (requires-approval), because none of the four reviewers' detectors
 * (Step 6) identify a change whose safety is verifiable by construction.
 * The one class of change this bot *does* auto-fix (formatting — see
 * autofix.ts) is handled by a completely separate mechanism that never
 * goes through this function, precisely because its safety comes from the
 * formatter's own contract, not from reviewing the specific finding.
 */
export function classifyFinding(finding: Finding): { classification: FixClassification; reason: string } {
  return { classification: "requires-approval", reason: APPROVAL_REASON[finding.category] };
}
