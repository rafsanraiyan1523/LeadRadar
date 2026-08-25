import { REVIEW_COMMENT_MARKER, type GitHubComment } from "./types";

export type CommentPlan = { action: "update"; commentId: number; body: string } | { action: "create"; body: string };

/**
 * Duplicate-review prevention: finds a prior review-bot comment (tagged
 * with REVIEW_COMMENT_MARKER) among the PR's existing comments and plans
 * an update to it instead of a new comment — a PR pushed to 5 times gets
 * one comment updated 5 times, never 5 separate comments. Pure and
 * side-effect-free: the caller performs the actual GitHub API call this
 * plan describes.
 */
export function planComment(existingComments: GitHubComment[], body: string): CommentPlan {
  const existing = existingComments.find((c) => c.body.includes(REVIEW_COMMENT_MARKER));
  return existing ? { action: "update", commentId: existing.id, body } : { action: "create", body };
}
