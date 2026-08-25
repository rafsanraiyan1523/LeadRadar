# GitHub Actions Deployment

Assignment: "From Review Criteria to a Bot Running in CI" — Step 11
(updated in Step 12, when the inline `actions/github-script` posting step
was replaced with `scripts/post-review.cjs` — a tested module rather than
untestable inline YAML JS — and a report-only auto-fix step and PR
triage/labeling were added; the trigger, permissions, and core execution
shape from Step 11 are unchanged).

Workflow file: [`.github/workflows/review-bot.yml`](../../.github/workflows/review-bot.yml).

## Status — read this first

**This workflow has been implemented and validated locally (YAML syntax +
script syntax — see [Local validation](#local-validation)).** Whether it
has been confirmed by an actual GitHub Actions run depends on what's
happened by the time you're reading this — see
[docs/assignment/final-submission.md](final-submission.md) for the actual,
current status of the live test, since that document (not this one) is
kept as the single source of truth for "has this actually run yet."

## Workflow trigger

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

- `opened` — the literal requirement from this step.
- `synchronize` (new commits pushed to the PR) and `reopened` were added
  because a review bot that only ever reviews the PR's first commit would
  go stale immediately — this is also *why* duplicate-review protection
  (below) is needed, not just "applicable" in the abstract.
- Deliberately **`pull_request`, not `pull_request_target`** — see
  [Security considerations](#security-considerations) for why this is a
  hard requirement, not a stylistic choice.

A `concurrency` group (`review-bot-<PR number>`, `cancel-in-progress: true`)
ensures a new push supersedes an in-flight review of an already-stale
commit rather than letting both finish and race to post.

## Permissions

```yaml
permissions:
  contents: read
  pull-requests: write
```

Exactly two scopes, matching this step's explicit instruction ("prefer
pull-request write access rather than broad repository write access"):
`contents: read` to check out the code, `pull-requests: write` to post/
update a review comment. No `issues: write`, no `contents: write`, no
`actions: write`, no `id-token`, no repository-admin scope of any kind.

## Secrets used

**Today: none, beyond the automatic `GITHUB_TOKEN`.** The four reviewers
implemented in Steps 5–6 are fully deterministic (git + static analysis) —
they make no external API calls and need no credential to run.
`post-review.cjs` (Step 12) receives `secrets.GITHUB_TOKEN` as a plain
`env:` value (scoped by the `permissions:` block above) and uses it as a
bearer token for direct GitHub REST API calls (`fetch`, no `@octokit`
dependency); it is never written into the workflow file as a literal
value, never echoed, and never included in any request body or log line.

**Wired for the future, unused today:**

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

on the "Run review bot" step only. This is a deliberate, documented
no-op right now — the architecture (Step 4) designs Plan and a
possible LLM-backed reviewer variant that would need a model credential;
this line means that when/if that's built, the workflow doesn't need to
change, only the secret needs to exist. Referencing an unset GitHub
secret is safe (it resolves to an empty string, not an error), and the
current bot never reads this environment variable at all.

**Never hardcoded anywhere:** no API key, token, password, or credential
literal appears in the workflow file, `review.cjs`, or any file this step
touched — confirmed by inspection (every credential-shaped reference in
the workflow is a `${{ secrets.* }}` or `${{ github.token }}` expression,
never a literal string).

## Review execution flow

1. **Checkout** — the PR's exact head SHA, `fetch-depth: 0` (full
   history). Full history is required, not optional: Explore's
   merge-base diffing (Step 3/5's design — diff against
   `git merge-base(base, head)`, not `base`'s current tip) needs the
   base branch's history to be present locally, and a shallow clone
   would silently break that computation.
2. **Install + build** — `pnpm install --frozen-lockfile` (same command
   the existing `ci.yml` uses — see Step 1's audit — so this workflow
   doesn't diverge from the repo's established install story), then
   `pnpm --filter @lead-radar/review-bot run build` (compiles `dist/`,
   which `review.cjs` requires and which is gitignored/never committed).
3. **Run the bot** —
   `node packages/review-bot/scripts/review.cjs "$GITHUB_WORKSPACE" "origin/<base-ref>" "<head-sha>"`
   — the exact same CLI entrypoint used for Step 9's real benchmark run,
   now invoked with the PR's real coordinates instead of
   `main`/`assignment/seeded-defects`. Output (a JSON array of
   `NormalizedFinding`) is redirected to `review-findings.json`; the
   script's own runtime schema validation (`validateFindings`, extracted
   to a tested TS module in Step 12 — see `pipeline/validate.ts`) rejects
   malformed output before anything downstream can see it.
4. **Check for safe auto-fixes (report only)** — `scripts/autofix.cjs`
   (Step 12) recomputes the same changed-file list via Explore and runs
   Prettier's dry-run check against it; results feed into the comment
   below. See [docs/assignment/autofix-and-triage.md](autofix-and-triage.md)
   for why this is report-only (no commit) in the current deployment.
5. **Post the review + set the triage label** — `scripts/post-review.cjs`
   (Step 12, replacing Step 11's inline `actions/github-script`) reads
   `review-findings.json` and `autofix-result.json`, renders a Markdown
   comment grouped MUST-FIX → SHOULD-FIX (or "no issues found" for an
   empty array) via the same `renderReviewComment` function
   `github/render.spec.ts` tests directly, and either creates a new PR
   comment or **updates the existing one** if a prior run's comment
   (tagged with an HTML marker, `<!-- review-bot:findings -->`) is found —
   duplicate-review protection: a PR pushed to 5 times gets 1 comment
   updated 5 times, not 5 separate comments (`planComment`,
   `comment-plan.spec.ts`). The same script then applies exactly one of
   three `review-bot:*` labels (`must-fix`/`should-fix`/`clean`) via
   `triagePR`/`planLabelChanges` (`triage.spec.ts`) — see
   [autofix-and-triage.md](autofix-and-triage.md) for the full triage
   rule.

## Failure behavior

Every failure mode this step names is handled, and handled the same
way — post a **safe, generic** comment (never raw error text, a stack
trace, or partial/malformed data) and mark the job failed so the check
shows red:

| Failure mode | What actually happens |
|---|---|
| The review "service" (the bot script) fails | `review.cjs` catches the thrown error, prints a message to **stderr** (never stdout, so it can never be mistaken for findings), exits 2. |
| The model/API is unavailable | No live dependency today (see Secrets), so not a real failure mode yet — but the same try/catch + exit-code path in `review.cjs` is exactly where a future model call's failure would surface, with no workflow changes needed. |
| The diff cannot be retrieved | `runReviewBot` → `runExplore` → `resolveMergeBase`/`getChangedFileStatuses` throw on a git failure (bad ref, missing history); caught by the same `review.cjs` try/catch as any other bot failure → exit 2. |
| The output is malformed | `review.cjs`'s own `validateFindings()` (added this step) checks every finding has all 11 required fields as non-empty strings and that `category`/`severity`/`confidence`/`source` are one of their valid enum values; any violation → exit 3, nothing printed to stdout. |

The workflow's own structure then takes over regardless of *which* of the
above happened: the "Run review bot" step uses `continue-on-error: true`
(so a failure there doesn't abort the job before a comment can be posted),
`steps.run_bot.outcome` (the true pre-continue-on-error result, not
`conclusion`) is recorded, the comment-posting step runs unconditionally
(`if: always()`) and posts a generic "the automated review could not
complete... this does NOT mean the PR is clean" message instead of the
findings when `outcome` wasn't `success`, and a final step explicitly
fails the job (`exit 1`) if the bot didn't succeed — so a human always
sees a red check, never a silently-green "no issues found" that's
actually "the bot crashed and nobody set up." A 10-minute job-level
timeout (plus a 5-minute inner timeout on the bot step itself) bounds
how long a hung install/build/bot-run can block the check.

**Output validation** is not only inside `review.cjs` — `post-review.cjs`
independently re-parses and re-validates (`validateFindings`, the same
tested function) before treating a file's content as findings, and falls
back to a safe error message (`renderMalformedOutputComment`) if that
fails, so a corrupted `review-findings.json` (e.g. a partial write) can't
crash the posting step either.

## Security considerations

- **`pull_request`, never `pull_request_target`.** This is the single
  most important security decision in this workflow, and costs
  something real (documented honestly, not glossed over): with
  `pull_request`, a PR opened from a *fork* gets a read-only
  `GITHUB_TOKEN` from GitHub itself, regardless of what this workflow's
  own `permissions:` block requests — so the comment-posting step's API
  calls will 403 for fork PRs specifically (caught in a try/catch,
  logged, not crashed — see the workflow file). The alternative,
  `pull_request_target`, gets a **write-scoped** token even for fork PRs
  — but it also runs against the *base* branch's workflow file while
  checking out the *fork's* (untrusted) code, which is the well-known
  GitHub Actions supply-chain pattern for leaking write-scoped secrets to
  an attacker-controlled PR. Given this bot's own architecture already
  treats PR diff content as untrusted, adversarial input (Step 4's
  "Adversarial-diff resilience" section), using `pull_request_target` to
  paper over the fork-PR comment-posting gap would directly contradict
  that principle. **Accepted tradeoff:** same-repo PRs get the full
  automated review; fork PRs get a failed/red check with a logged reason,
  but no posted comment, until a maintainer reviews manually. That's a
  safe default, not a bug.
- **No hardcoded credentials anywhere** (checked above).
- **No secret leakage in logs.** `ANTHROPIC_API_KEY` is never echoed,
  printed, or interpolated into a log line, a comment body, or an error
  message anywhere in the workflow or `review.cjs`. GitHub Actions also
  automatically masks any string matching a registered secret's value in
  raw log output, as a second layer.
- **Minimum permissions**, stated once, enforced by GitHub — not a
  convention that could silently drift, since the `permissions:` block is
  the actual authorization boundary GitHub's API enforces, not just
  documentation of intent.
- **The ground-truth isolation guarantee still holds in CI.** Nothing
  about this workflow changes how `runReviewBot`/Explore work — the
  denylist and structural absence-from-branch-history protections from
  Steps 3–5 apply identically whether invoked locally (Step 9) or from
  this workflow.

## Local validation

Performed, and reproducible:

```
$ node -e "require('js-yaml').load(fs.readFileSync('.github/workflows/review-bot.yml','utf8'))"
YAML parsed successfully.
Number of steps: 10
Permissions: {"contents":"read","pull-requests":"write"}
```

```
$ node --check packages/review-bot/scripts/post-review.cjs
$ node --check packages/review-bot/scripts/autofix.cjs
(both exit 0)
```

```
$ node packages/review-bot/scripts/review.cjs "<repo>" main assignment/seeded-defects
$ node packages/review-bot/scripts/autofix.cjs "<repo>" main assignment/seeded-defects
(both exit 0 — the same two commands the workflow's "Run review bot" and
"Check for safe auto-fixes" steps run, exercised directly)
```

```
(post-review.cjs's request sequence was verified with a mocked `fetch`
before being wired into the workflow — confirmed it correctly updates an
existing marker-bearing comment rather than creating a duplicate, and
correctly computes the label add/remove diff when a PR's severity
changes between runs — see docs/assignment/autofix-and-triage.md)
```

**What local validation could *not* cover** (no GitHub Actions runner
available in this environment, and `actionlint` was not installed —
checked and confirmed absent): whether `pnpm/action-setup@v4` /
`actions/checkout@v4` / `actions/setup-node@v4` resolve and behave exactly
as expected on `ubuntu-latest`; whether the `${{ }}` expression syntax is
semantically valid (only *syntactically* plausible, per YAML parsing —
GitHub's own expression evaluator wasn't available to check against);
whether the real GitHub REST API behaves exactly as `post-review.cjs`
assumes against a real PR (as opposed to a mocked `fetch`); and the
fork-PR 403 behavior described above, which can only be observed against
a real fork PR.

## What's needed to actually run this

1. **Nothing to configure to get a first real run.** No repository
   secrets are required — `GITHUB_TOKEN` is provided automatically by
   GitHub Actions for every workflow run, scoped by the `permissions:`
   block already in the file. `gh secret list` was run against this
   repository and returned zero existing secrets, confirming there's
   nothing already configured to conflict with or duplicate.
2. **Push this workflow file to `main` and open a same-repository PR** —
   that's the only way to get a genuine GitHub Actions run confirming the
   parts local validation couldn't reach (listed above). This is carried
   out in Step 12 (see [final-submission.md](final-submission.md) for the
   real outcome — PR URL, workflow run, and whether the comment/labels
   actually appeared).
3. **Optional, only if/when a future LLM-backed stage is built:** add a
   repository secret named `ANTHROPIC_API_KEY` (Settings → Secrets and
   variables → Actions → New repository secret). **I cannot and did not
   set this for you** — there is no real key to set, and fabricating one
   would violate the same "never hardcode/never fabricate credentials"
   rule this step is about. Until that future stage exists, leave it
   unset; the workflow runs identically either way.
