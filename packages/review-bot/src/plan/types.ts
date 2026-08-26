import type { ReviewerName } from "../pipeline/types";

export type PlanPriority = "high" | "medium" | "low";

/**
 * One changed file's review plan: which reviewers should look at it, why,
 * what Explore fields they'll need, and how urgent it looks. This is the
 * unit Plan routes per file — see docs/assignment/subagent-architecture.md
 * §2 for the designed contract this implements.
 */
export interface PlanArea {
  file: string;
  /** Symbol names Explore attributed to this file's changed hunks, where available (may be empty). */
  relevantSymbols: string[];
  selectedReviewers: ReviewerName[];
  /** Why these reviewers, in plain language — never a severity claim, Plan makes no judgment about whether anything is actually wrong. */
  rationale: string;
  /** Which ExploreContextPackage fields the selected reviewers' narrowed input actually needs for this file. */
  contextRequirements: string[];
  priority: PlanPriority;
}

export interface IgnoredFile {
  file: string;
  reason: string;
}

export interface Plan {
  /** One-line, mechanically-derived summary of what this PR needs reviewed and why. */
  reviewScope: string;
  /** Union of every reviewer selected across all areas — which categories are invoked at all for this PR. */
  selectedReviewers: ReviewerName[];
  relevantFiles: string[];
  areas: PlanArea[];
  ignoredFiles: IgnoredFile[];
}
