import type { NormalizedFinding } from "../pipeline/types";
import { ALL_TRIAGE_LABELS, TRIAGE_LABELS, type TriageLabel } from "./types";

/**
 * PR-level triage rule (docs/assignment/autofix-and-triage.md): the
 * highest severity present among a PR's (already-normalized, deduplicated,
 * filtered — see pipeline.ts) findings determines the PR's single label.
 * Deliberately simple and total — every possible finding set maps to
 * exactly one of exactly three labels, no in-between state.
 */
export function triagePR(findings: NormalizedFinding[]): TriageLabel {
  if (findings.some((f) => f.severity === "MUST-FIX")) return TRIAGE_LABELS.mustFix;
  if (findings.some((f) => f.severity === "SHOULD-FIX")) return TRIAGE_LABELS.shouldFix;
  return TRIAGE_LABELS.clean;
}

export interface LabelChangePlan {
  toAdd: string[];
  toRemove: string[];
}

/**
 * Computes the minimal label change needed to make `target` the PR's only
 * review-bot:* label, leaving every other (non-review-bot) label on the PR
 * untouched. Pure and total: never removes a label this bot didn't apply,
 * never adds a label that's already present.
 */
export function planLabelChanges(currentLabels: string[], target: TriageLabel): LabelChangePlan {
  const current = new Set(currentLabels);
  const toRemove = ALL_TRIAGE_LABELS.filter((label) => label !== target && current.has(label));
  const toAdd = current.has(target) ? [] : [target];
  return { toAdd, toRemove };
}
