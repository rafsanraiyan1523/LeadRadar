import { runExplore } from "../explore/explore";
import { readFileAtRef } from "../explore/git";
import { reviewLogic } from "../reviewers/logic/logic-reviewer";
import { reviewTestCoverage } from "../reviewers/test-coverage/test-coverage-reviewer";
import { reviewSecurity } from "../reviewers/security/security-reviewer";
import { reviewStyle } from "../reviewers/style/style-reviewer";
import {
  narrowForLogicReview,
  narrowForSecurityReview,
  narrowForStyleReview,
  narrowForTestCoverageReview,
} from "../reviewers/shared/types";
import { deduplicateFindings, filterFindings, normalizeFindings } from "./pipeline";
import type { NormalizedFinding, RawFinding } from "./types";

export interface RunReviewBotOptions {
  repoPath: string;
  baseRef: string;
  headRef?: string;
  /** Injectable for tests; defaults to a real git read against repoPath/headRef. */
  readFile?: (path: string) => string | null;
}

/**
 * The whole deterministic half of the pipeline in
 * docs/assignment/subagent-architecture.md: PR diff → Explore →
 * (today: static narrowing, standing in for Plan — see
 * docs/assignment/context-strategy.md §4) → the four specialized
 * reviewers → normalize → deduplicate → filter. Stops short of Final
 * Review (still a designed-not-built LLM synthesis stage) — this
 * function's output is the filtered NormalizedFinding[] a human or Final
 * Review would consume next.
 */
export function runReviewBot(options: RunReviewBotOptions): NormalizedFinding[] {
  const headRef = options.headRef ?? "HEAD";
  const readFile = options.readFile ?? ((path: string) => readFileAtRef(options.repoPath, headRef, path));

  const pkg = runExplore({ repoPath: options.repoPath, baseRef: options.baseRef, headRef });

  const raw: RawFinding[] = [
    ...reviewLogic(narrowForLogicReview(pkg)).map((finding) => ({ finding, source: "logic" as const })),
    ...reviewTestCoverage(narrowForTestCoverageReview(pkg), readFile).map((finding) => ({ finding, source: "test-coverage" as const })),
    ...reviewSecurity(narrowForSecurityReview(pkg), readFile).map((finding) => ({ finding, source: "security" as const })),
    ...reviewStyle(narrowForStyleReview(pkg), readFile).map((finding) => ({ finding, source: "style-maintainability" as const })),
  ];

  const normalized = normalizeFindings(raw);
  const deduplicated = deduplicateFindings(normalized);
  return filterFindings(deduplicated);
}
