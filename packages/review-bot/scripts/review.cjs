#!/usr/bin/env node
// Minimal CLI entrypoint: runs the review bot exactly as it would run in
// CI against a PR — repoPath + baseRef + headRef in, structured findings
// out, printed as JSON. No other input (no answer key, no defect hints,
// no repo-specific flags) is accepted or read.
//
// Usage: node scripts/review.cjs <repoPath> <baseRef> <headRef>
//
// Exit codes:
//   0  success — findings (possibly []) printed as JSON to stdout
//   1  usage error (missing arguments)
//   2  the bot itself threw (diff couldn't be retrieved, git error, etc.)
//   3  the bot's own output failed schema validation (should never happen
//      in practice — reviewers are typed — but never trust output blindly
//      when a CI step is about to post it somewhere public). See
//      src/pipeline/validate.ts for the actual check (also unit-tested).
const { runReviewBot, validateFindings } = require("../dist");

function main() {
  const [, , repoPath, baseRef, headRef] = process.argv;

  if (!repoPath || !baseRef) {
    console.error("Usage: node scripts/review.cjs <repoPath> <baseRef> <headRef>");
    process.exit(1);
  }

  let findings;
  try {
    findings = runReviewBot({ repoPath, baseRef, headRef });
  } catch (error) {
    console.error(`Review bot failed: ${error && error.message ? error.message : error}`);
    process.exit(2);
  }

  try {
    validateFindings(findings);
  } catch (error) {
    console.error(`Review bot produced malformed output: ${error.message}`);
    process.exit(3);
  }

  console.log(JSON.stringify(findings, null, 2));
}

main();
