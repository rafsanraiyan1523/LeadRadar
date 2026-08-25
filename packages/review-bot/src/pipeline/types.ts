import type { Finding } from "../rubric/types";

export type ReviewerName = "logic" | "test-coverage" | "security" | "style-maintainability";

/** A Finding plus pipeline bookkeeping — assigned by normalizeFindings, never by a reviewer itself. */
export interface NormalizedFinding extends Finding {
  id: string;
  source: ReviewerName;
}

export interface RawFinding {
  finding: Finding;
  source: ReviewerName;
}
