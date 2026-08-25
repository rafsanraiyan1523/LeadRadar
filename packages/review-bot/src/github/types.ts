export const REVIEW_COMMENT_MARKER = "<!-- review-bot:findings -->";

/** Exactly three labels, mutually exclusive per PR — see docs/assignment/autofix-and-triage.md. */
export const TRIAGE_LABELS = {
  mustFix: "review-bot:must-fix",
  shouldFix: "review-bot:should-fix",
  clean: "review-bot:clean",
} as const;

export type TriageLabel = (typeof TRIAGE_LABELS)[keyof typeof TRIAGE_LABELS];

export const ALL_TRIAGE_LABELS: readonly TriageLabel[] = Object.values(TRIAGE_LABELS);

export const LABEL_COLORS: Record<TriageLabel, string> = {
  [TRIAGE_LABELS.mustFix]: "b60205", // red
  [TRIAGE_LABELS.shouldFix]: "fbca04", // yellow
  [TRIAGE_LABELS.clean]: "0e8a16", // green
};

export interface GitHubComment {
  id: number;
  body: string;
}
