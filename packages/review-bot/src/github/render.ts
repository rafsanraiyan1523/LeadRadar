import type { NormalizedFinding } from "../pipeline/types";
import type { AutofixResult } from "../autofix/autofix";
import { REVIEW_COMMENT_MARKER } from "./types";

function renderFinding(f: NormalizedFinding): string {
  return `- **[${f.category}] ${f.severity}** — ${f.title}\n  - \`${f.file}:${f.line}\` (confidence: ${f.confidence})\n  - ${f.explanation}\n  - Suggested fix: ${f.suggested_fix}`;
}

/** The bot's own run failed before findings could be produced — a safe, generic notice, never raw error text. */
export function renderFailureComment(runUrl: string): string {
  return [
    REVIEW_COMMENT_MARKER,
    "### 🤖 Review bot",
    "",
    `The automated review could not complete for this commit — see the **Run review bot** step in [this workflow run](${runUrl}) for details.`,
    "This does **not** mean the PR is clean, only that the bot did not finish running.",
  ].join("\n");
}

/** review.cjs's own output validation rejected the findings, or the file couldn't be parsed — never post malformed/partial data. */
export function renderMalformedOutputComment(reason: string): string {
  return [REVIEW_COMMENT_MARKER, "### 🤖 Review bot", "", `The review bot ran, but its output could not be read (${reason}). No findings were posted.`].join("\n");
}

export function renderAutofixSection(autofix: AutofixResult | null): string {
  if (!autofix || autofix.files.length === 0) return "";
  if (autofix.filesChanged.length === 0) {
    return "#### 🛠️ Auto-fix\n\nChecked formatting on this PR's changed files — nothing to fix.";
  }
  const list = autofix.filesChanged.map((f) => `- \`${f}\``).join("\n");
  return autofix.applied
    ? `#### 🛠️ Auto-fix\n\nFormatting was automatically fixed and committed for:\n\n${list}`
    : `#### 🛠️ Auto-fix (not applied — report only)\n\nThese files have formatting that Prettier would fix, but this run didn't commit it:\n\n${list}`;
}

export function renderReviewComment(findings: NormalizedFinding[], autofix: AutofixResult | null = null): string {
  const autofixSection = renderAutofixSection(autofix);

  if (findings.length === 0) {
    return [REVIEW_COMMENT_MARKER, "### 🤖 Review bot", "", "No issues found in this PR's changed files.", autofixSection].filter(Boolean).join("\n\n");
  }

  const must = findings.filter((f) => f.severity === "MUST-FIX");
  const should = findings.filter((f) => f.severity === "SHOULD-FIX");

  return [
    REVIEW_COMMENT_MARKER,
    "### 🤖 Review bot",
    "",
    must.length ? `#### MUST-FIX (${must.length})\n\n${must.map(renderFinding).join("\n")}` : "",
    should.length ? `#### SHOULD-FIX (${should.length})\n\n${should.map(renderFinding).join("\n")}` : "",
    autofixSection,
  ]
    .filter(Boolean)
    .join("\n\n");
}
