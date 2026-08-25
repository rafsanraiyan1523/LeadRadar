#!/usr/bin/env node
// Runs safe (Prettier-only — see src/autofix/autofix.ts) auto-fix against
// the PR's own changed files, recomputed via the same Explore step the
// reviewers use (never a separately-derived file list that could drift
// from what's actually in the diff).
//
// Report-only by default (dryRun): detects and reports what Prettier
// would change without writing anything — matching this deployment's
// current minimum-permissions configuration (contents: read; see
// docs/assignment/autofix-and-triage.md and github-actions.md for why
// auto-committing isn't enabled yet). Pass --apply to actually write the
// fixes (requires contents: write, not granted in the current workflow).
//
// Usage: node scripts/autofix.cjs <repoPath> <baseRef> <headRef> [--apply]
const { runExplore, runSafeAutofix } = require("../dist");

async function main() {
  const [, , repoPath, baseRef, headRef, flag] = process.argv;
  if (!repoPath || !baseRef) {
    console.error("Usage: node scripts/autofix.cjs <repoPath> <baseRef> <headRef> [--apply]");
    process.exit(1);
  }
  const apply = flag === "--apply";

  let files;
  try {
    const pkg = runExplore({ repoPath, baseRef, headRef });
    files = pkg.changedFiles.filter((f) => f.changeKind !== "deleted").map((f) => f.path);
  } catch (error) {
    console.error(`Could not compute changed files for auto-fix: ${error.message}`);
    console.log(JSON.stringify({ files: [], filesChanged: [], applied: false }));
    return; // non-fatal — auto-fix is best-effort, never blocks the review itself
  }

  const result = await runSafeAutofix(repoPath, files, { dryRun: !apply });
  console.log(JSON.stringify(result, null, 2));
}

main();
