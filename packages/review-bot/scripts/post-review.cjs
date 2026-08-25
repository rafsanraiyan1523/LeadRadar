#!/usr/bin/env node
// Posts (or updates) the review-bot PR comment and sets the triage label,
// using the plain GitHub REST API (fetch — no @octokit dependency needed).
// Every decision here (create-vs-update, which label) is delegated to the
// same tested, pure functions the unit tests exercise directly — this
// script is just the thin, mostly-untestable-without-a-real-API glue
// around them.
//
// Usage: node scripts/post-review.cjs <findings-json-path|__FAILED__> <run-url> [autofix-json-path]
// Required env: GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo), PR_NUMBER
//
// NEVER logs the token. Every network error is caught and logged with a
// safe, specific message — this script never lets an unhandled rejection
// take down the step with a raw stack trace that might echo request
// headers.
const fs = require("node:fs");
const {
  renderReviewComment,
  renderFailureComment,
  renderMalformedOutputComment,
  planComment,
  triagePR,
  planLabelChanges,
  validateFindings,
  ALL_TRIAGE_LABELS,
  LABEL_COLORS,
} = require("../dist");

const GITHUB_API = "https://api.github.com";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubRequest(token, method, path, body) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: { ...authHeaders(token), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok && response.status !== 422) {
    // 422 is handled per-call-site (e.g. "label already exists") — every
    // other non-2xx is a real failure. Read the body for a specific
    // reason, but never assume it's safe to print verbatim (GitHub error
    // bodies don't contain secrets, but we still keep this terse).
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub API ${method} ${path} -> ${response.status}: ${text.slice(0, 300)}`);
  }
  return response;
}

async function ensureLabelsExist(token, owner, repo) {
  for (const label of ALL_TRIAGE_LABELS) {
    try {
      await githubRequest(token, "POST", `/repos/${owner}/${repo}/labels`, { name: label, color: LABEL_COLORS[label] });
    } catch (error) {
      // Already exists (422) is expected on every run after the first —
      // anything else is a real problem worth surfacing.
      if (!/422/.test(error.message)) throw error;
    }
  }
}

async function applyTriageLabel(token, owner, repo, prNumber, findings) {
  const target = triagePR(findings);
  const current = await githubRequest(token, "GET", `/repos/${owner}/${repo}/issues/${prNumber}/labels`).then((r) => r.json());
  const currentNames = current.map((l) => l.name);
  const plan = planLabelChanges(currentNames, target);

  await ensureLabelsExist(token, owner, repo);

  for (const label of plan.toRemove) {
    await githubRequest(token, "DELETE", `/repos/${owner}/${repo}/issues/${prNumber}/labels/${encodeURIComponent(label)}`).catch((error) => {
      console.error(`Could not remove label "${label}": ${error.message}`);
    });
  }
  if (plan.toAdd.length > 0) {
    await githubRequest(token, "POST", `/repos/${owner}/${repo}/issues/${prNumber}/labels`, { labels: plan.toAdd });
  }
  return target;
}

async function postOrUpdateComment(token, owner, repo, prNumber, body) {
  const comments = await githubRequest(token, "GET", `/repos/${owner}/${repo}/issues/${prNumber}/comments`).then((r) => r.json());
  const plan = planComment(
    comments.map((c) => ({ id: c.id, body: c.body || "" })),
    body,
  );
  if (plan.action === "update") {
    await githubRequest(token, "PATCH", `/repos/${owner}/${repo}/issues/comments/${plan.commentId}`, { body: plan.body });
  } else {
    await githubRequest(token, "POST", `/repos/${owner}/${repo}/issues/${prNumber}/comments`, { body: plan.body });
  }
  return plan.action;
}

async function main() {
  const [, , findingsPath, runUrl, autofixPath] = process.argv;
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;

  if (!token || !repoFull || !prNumber || !findingsPath || !runUrl) {
    console.error("Usage: GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo PR_NUMBER=N node scripts/post-review.cjs <findings-json-path|__FAILED__> <run-url> [autofix-json-path]");
    process.exit(1);
  }
  const [owner, repo] = repoFull.split("/");

  let body;
  let findings = [];
  if (findingsPath === "__FAILED__") {
    body = renderFailureComment(runUrl);
  } else {
    try {
      const parsed = JSON.parse(fs.readFileSync(findingsPath, "utf8"));
      validateFindings(parsed);
      findings = parsed;
      let autofix = null;
      if (autofixPath && fs.existsSync(autofixPath)) {
        autofix = JSON.parse(fs.readFileSync(autofixPath, "utf8"));
      }
      body = renderReviewComment(findings, autofix);
    } catch (error) {
      body = renderMalformedOutputComment(error.message);
    }
  }

  try {
    const action = await postOrUpdateComment(token, owner, repo, prNumber, body);
    console.log(`Comment ${action}d.`);
  } catch (error) {
    // A fork PR gets a read-only token regardless of this workflow's own
    // permissions: block (GitHub's own protection) — that shows up here
    // as a 403. Documented, expected, not a crash. See
    // docs/assignment/github-actions.md's Security considerations.
    console.error(`Could not post/update the PR comment (possibly a fork PR with a read-only token): ${error.message}`);
  }

  try {
    const label = await applyTriageLabel(token, owner, repo, prNumber, findings);
    console.log(`Triage label set to "${label}".`);
  } catch (error) {
    console.error(`Could not set the triage label: ${error.message}`);
  }
}

main();
