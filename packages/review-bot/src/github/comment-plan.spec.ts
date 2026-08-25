import { describe, expect, it } from "vitest";
import { planComment } from "./comment-plan";
import { REVIEW_COMMENT_MARKER } from "./types";

describe("planComment — duplicate review prevention", () => {
  it("plans to create a new comment when no prior review-bot comment exists", () => {
    const plan = planComment([{ id: 1, body: "an unrelated human comment" }], "new body");
    expect(plan.action).toBe("create");
    expect(plan.body).toBe("new body");
  });

  it("plans to update the existing review-bot comment instead of creating a second one", () => {
    const plan = planComment(
      [
        { id: 1, body: "an unrelated human comment" },
        { id: 42, body: `${REVIEW_COMMENT_MARKER}\n### old findings` },
      ],
      "new findings",
    );
    expect(plan.action).toBe("update");
    expect(plan.action === "update" && plan.commentId).toBe(42);
    expect(plan.body).toBe("new findings");
  });

  it("targets the correct comment when the review-bot comment is not the only, or not the first, comment", () => {
    const plan = planComment(
      [
        { id: 1, body: "first human comment" },
        { id: 2, body: `${REVIEW_COMMENT_MARKER}\nprevious run` },
        { id: 3, body: "a later human reply" },
      ],
      "latest findings",
    );
    expect(plan.action).toBe("update");
    expect(plan.action === "update" && plan.commentId).toBe(2);
  });

  it("never plans two updates for two separate marker-bearing comments — picks the first found deterministically", () => {
    // Defensive case: this should never legitimately happen (this bot
    // always updates rather than creates), but if it somehow did, the
    // plan must still be deterministic, not ambiguous.
    const plan = planComment(
      [
        { id: 5, body: `${REVIEW_COMMENT_MARKER}\nrun A` },
        { id: 6, body: `${REVIEW_COMMENT_MARKER}\nrun B` },
      ],
      "latest",
    );
    expect(plan.action).toBe("update");
    expect(plan.action === "update" && plan.commentId).toBe(5);
  });
});
