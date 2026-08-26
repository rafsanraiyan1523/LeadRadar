# Auto-fix and PR Triage

Assignment: "From Review Criteria to a Bot Running in CI" — Step 12

Code: [`packages/review-bot/src/autofix/`](../../packages/review-bot/src/autofix/),
[`packages/review-bot/src/github/`](../../packages/review-bot/src/github/),
[`packages/review-bot/scripts/{autofix,post-review}.cjs`](../../packages/review-bot/scripts/).

## Auto-fix

### What is automatic

**Exactly one thing: Prettier formatting on the PR's own changed files.**
`runSafeAutofix()` calls Prettier's JS API directly (not a shell-out) on
each changed file, using whatever `.prettierrc.json` the repo already has.
Its safety argument is not "the bot decided this looks safe" — it's that
**Prettier's entire contract is to only ever change whitespace/formatting,
never semantics**. This bot doesn't re-verify that claim; it relies on
Prettier's own well-established guarantee, the same way Step 6's
Style reviewer already deferred all formatting concerns to the project's
existing tooling rather than re-implementing them.

Deliberately **not** implemented: `eslint --fix`. Unlike Prettier,
ESLint's autofix safety is rule-by-rule, not a single blanket contract —
some fixable rules are unambiguously safe (`prefer-const`), others have
historically had edge cases. Rather than auditing every fixable rule in
this repo's config and asserting each is safe, the simpler and more
honest boundary is: only apply the one class of fix (formatting) whose
safety doesn't depend on which specific rule fired.

### What always requires human approval

**Every finding from all four reviewers, unconditionally.**
`classifyFinding()` returns `"requires-approval"` for every category,
with a category-specific reason (not a blanket excuse):

| Category | Why it requires approval |
|---|---|
| `logic-error` | Fixing it requires knowing the *intended* behavior (e.g. which comparison boundary was meant) — business-logic judgment. |
| `missing-tests` | A test that locks in current behavior is only safe if that behavior is actually correct; auto-writing one risks codifying a bug as "expected". |
| `security` | Never auto-fixed, full stop, regardless of how simple the fix looks. |
| `style-maintainability` | The detectors identify a problem (duplication, complexity) but not a safe mechanical rewrite — extraction/renaming needs human design judgment. |

This directly satisfies the step's DO-NOT list: nothing here ever touches
security-sensitive behavior, business logic, authN/authZ, migrations,
destructive operations, or ambiguous logic — because *all four reviewer
categories* are treated as exactly that, with no per-finding exception.

### Deployment configuration (current live workflow)

The auto-fix workflow step (`scripts/autofix.cjs`) runs **report-only**
(`dryRun: true`, the default — no `--apply` flag passed): it detects what
Prettier would change and includes it in the PR comment, but does **not**
write or commit anything. This is a deliberate, documented choice, not a
missing feature:

- Committing back to a PR branch needs `contents: write`. The workflow
  (Step 11) deliberately runs with `contents: read` only — see
  [github-actions.md](github-actions.md)'s "minimum permissions"
  reasoning. Adding write access specifically to auto-commit formatting
  fixes is a real, considered tradeoff, not a rubber stamp, and this
  step's priority was landing a correctly-scoped, tested capability over
  a first, unreviewed live commit-and-push against a real repository.
- `runSafeAutofix()` itself fully supports applying fixes
  (`dryRun: false`) and is tested doing exactly that (see
  [Tests](#tests) below) — enabling it live is a one-line change
  (`autofix.cjs --apply` + `contents: write` in the workflow), not a
  redesign. Not enabled today, deliberately — kept report-only per the
  minimum-permissions reasoning above.

**A real caveat surfaced while verifying this locally, worth stating
plainly:** running `autofix.cjs` against this repository's own checkout
on this development machine (Windows, `core.autocrlf=true`) reports all
three of `assignment/seeded-defects`' files as "Prettier would change
them" — but that's a CRLF-vs-LF line-ending artifact from the local
Windows checkout, not a real formatting problem (verified directly: the
content is byte-identical to Prettier's output once line endings are
normalized). GitHub Actions runs on `ubuntu-latest`, which checks out
files with their committed line endings (no autocrlf rewriting), so this
false signal is not expected to reproduce there — but it's exactly the
kind of thing this bot should not silently paper over, so it's recorded
here rather than left for a live run to surface unexplained.

## PR triage

### The exact rule

```ts
function triagePR(findings) {
  if (findings.some(f => f.severity === "MUST-FIX")) return "review-bot:must-fix";
  if (findings.some(f => f.severity === "SHOULD-FIX")) return "review-bot:should-fix";
  return "review-bot:clean";
}
```

One PR-level label, derived from the **highest** severity present among
its (already deduplicated, filtered — Step 8's pipeline) findings. Every
possible finding set maps to exactly one of exactly three outcomes — no
partial/ambiguous state. `IGNORE`-severity and low-confidence findings
never reach this function at all (filtered upstream in `pipeline.ts`), so
this triage rule only ever sees the two severities the rubric actually
surfaces to a reviewer — which is what "classify findings by must-fix /
should-fix / ignore" already means end-to-end in this bot: MUST-FIX and
SHOULD-FIX findings are what a human sees; IGNORE-severity candidates are
never constructed as findings at all (Step 6's evidence gate) or are
filtered before this point (Step 8) — there is no separate "ignore" label,
because an ignored finding is, by design, never surfaced to be labeled.

### Exactly three labels — no more

`review-bot:must-fix` (red), `review-bot:should-fix` (yellow),
`review-bot:clean` (green) — created once (idempotently, ignoring "already
exists" on every run after the first) and then **replaced**, never
accumulated: `planLabelChanges()` computes the minimal diff to make the
target label the PR's only `review-bot:*` label, removing whichever of
the other two might be stale from an earlier push, and never touching any
label this bot didn't apply (a human's own labels are left alone). A PR
that goes from must-fix → clean across three pushes ends with exactly one
label, not three.

### Where triage shows up

Both places named in the step's instructions:

- **PR comment** — findings are already grouped MUST-FIX before SHOULD-FIX
  in the rendered comment body (`renderReviewComment`, Step 11).
- **GitHub label** — `post-review.cjs` calls `triagePR()` +
  `planLabelChanges()` and applies the result via the same PR's Issues API
  the comment uses, in the same script run.

## Tests

29 new tests across 6 files, all hermetic (no network, no real GitHub
API — the one script that talks to the real API, `post-review.cjs`, was
separately verified with a mocked `fetch` before being wired into the
live workflow, confirming its request sequence, and has since been
confirmed against the real GitHub API in live workflow runs).

| Requirement | File | What it proves |
|---|---|---|
| Safe auto-fix | `autofix/autofix.spec.ts` | A genuinely malformed file is reformatted and **written to disk**; an already-clean file is left untouched and reported as unchanged; dry-run mode reports changes without writing; only the given files are touched, never siblings in the same directory. |
| Unsafe fix requiring approval | `autofix/classify.spec.ts` | All four finding categories classify as `requires-approval`, each with a non-empty, category-specific reason; the security reason is identical regardless of the specific finding's content (a blanket policy, not a per-finding judgment call). |
| Severity classification | `github/triage.spec.ts` | Any MUST-FIX finding wins the PR-level label even alongside SHOULD-FIX ones; SHOULD-FIX-only maps correctly; zero findings maps to clean. |
| Label/triage behavior | `github/triage.spec.ts` | `planLabelChanges` adds the right label from a blank slate, removes a stale label on improvement, does nothing when already correct, and never touches a label it doesn't own. |
| Malformed review output | `pipeline/validate.spec.ts` | A well-formed array passes; a non-array, a finding missing a field, an empty-string field, an invalid category/severity/confidence/source, and a non-object array entry are each rejected with a specific, field-naming error. |
| Duplicate review prevention | `github/comment-plan.spec.ts` | No prior comment → create; a prior marker-bearing comment anywhere in the thread (not just first) → update that exact comment, never a new one; deterministic behavior even in the (should-never-happen) case of two marker-bearing comments. |
| (supporting) Comment rendering | `github/render.spec.ts` | Every rendered body carries the dedup marker; a clean PR says so in words; MUST-FIX is ordered before SHOULD-FIX; failure/malformed-output messages never leak raw findings data or error internals. |

### Actual results

```
$ pnpm --filter @lead-radar/review-bot run typecheck   → clean
$ pnpm --filter @lead-radar/review-bot run lint         → clean
$ pnpm --filter @lead-radar/review-bot run test

 Test Files  18 passed (18)
      Tests  114 passed (114)
```

(85 pre-existing from Steps 5–8 + 29 new this step.)
