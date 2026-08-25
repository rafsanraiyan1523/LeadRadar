/**
 * The finding schema from docs/assignment/review-rubric.md's "Output format"
 * section, reproduced exactly (field names included) so every reviewer
 * emits directly-interoperable, rubric-conformant output — no translation
 * layer needed downstream.
 */

export type FindingCategory = "logic-error" | "missing-tests" | "security" | "style-maintainability";

/**
 * IGNORE exists in the type for schema completeness (matching the rubric's
 * own note that IGNORE is "not a value that reaches the final report") but
 * no reviewer in this codebase ever constructs a Finding with it — the
 * evidence gate means an insufficiently-grounded candidate is never turned
 * into a Finding at all, rather than being created and then downgraded.
 */
export type FindingSeverity = "MUST-FIX" | "SHOULD-FIX" | "IGNORE";

export type FindingConfidence = "high" | "medium" | "low";

export interface Finding {
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  file: string;
  /** A single line ("22") or an inclusive range ("106-114"), per the rubric. */
  line: string;
  explanation: string;
  evidence: string;
  suggested_fix: string;
  confidence: FindingConfidence;
}
