# TDD Evidence — Locking In Review-Bot Behavior

Assignment: "From Review Criteria to a Bot Running in CI" — Step 8

This step required genuinely new functionality, not just new tests over
existing code: Steps 5–6 built Explore and the four reviewers, but the
[architecture's](subagent-architecture.md) Finding Normalization,
Deduplication, and Severity/Confidence Filtering stages — and the
orchestrator wiring everything together into one "bot" — did not exist
yet. That made honest red→green TDD straightforward: the tests below were
written against modules that genuinely did not exist, run, and confirmed
to fail for exactly that reason, before any implementation was written.

## Test objective

Lock in, with executable tests, the nine behaviors Step 8 requires:

1. A seeded-style logic bug is flagged.
2. A meaningful untested code path is flagged.
3. A hardcoded synthetic secret is flagged.
4. A clean file/change is NOT incorrectly flagged.
5. Findings have the required structured schema.
6. Severity follows the review rubric.
7. Duplicate findings are removed.
8. Low-confidence speculative findings are filtered.
9. The bot does not report unrelated unchanged code.

Two new test files carry this:
[packages/review-bot/src/pipeline/pipeline.spec.ts](../../packages/review-bot/src/pipeline/pipeline.spec.ts)
(unit tests for normalization/deduplication/filtering — requirements 5, 7, 8
in isolation) and
[packages/review-bot/src/pipeline/run-review-bot.spec.ts](../../packages/review-bot/src/pipeline/run-review-bot.spec.ts)
(end-to-end tests against a hermetic temp git repo — requirements 1, 2, 3,
4, 5, 6, 8, 9 through the whole pipeline at once).

## Step 1–3: write the tests, run them, confirm the expected failure

Both spec files were written first, importing from `./pipeline` and
`./run-review-bot` — modules that did not exist in the repository at that
point. Running them:

```
$ pnpm --filter @lead-radar/review-bot run test -- run-review-bot pipeline
```

Actual output (unedited):

```
⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯

FAIL  src/pipeline/pipeline.spec.ts [ src/pipeline/pipeline.spec.ts ]
Error: Failed to load url ./pipeline (resolved id: ./pipeline) in
F:/Projects/PR Review Bot/packages/review-bot/src/pipeline/pipeline.spec.ts.
Does the file exist?

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

FAIL  src/pipeline/run-review-bot.spec.ts [ src/pipeline/run-review-bot.spec.ts ]
Error: Failed to load url ./run-review-bot (resolved id: ./run-review-bot) in
F:/Projects/PR Review Bot/packages/review-bot/src/pipeline/run-review-bot.spec.ts.
Does the file exist?

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  2 failed | 10 passed (12)
      Tests  68 passed (68)
```

**This is the expected failure, for the expected reason.** Not an
assertion failure — a module-resolution failure, because
`normalizeFindings`/`deduplicateFindings`/`filterFindings` (pipeline.ts)
and `runReviewBot` (run-review-bot.ts) genuinely did not exist yet. The
other 10 already-existing test files (68 tests, all from Steps 5–6) kept
passing throughout, confirming this was a clean addition, not a
regression already in progress.

## Step 4: implement the behavior

Three new modules were written to make the above pass:

- [`packages/review-bot/src/pipeline/types.ts`](../../packages/review-bot/src/pipeline/types.ts) —
  `NormalizedFinding` (a `Finding` plus `id`/`source`).
- [`packages/review-bot/src/pipeline/pipeline.ts`](../../packages/review-bot/src/pipeline/pipeline.ts) —
  `normalizeFindings` (stamps a stable id + source reviewer onto each raw
  finding), `deduplicateFindings` (groups findings by `(file, overlapping
  line range)` regardless of category, per the rubric's "same root cause
  flagged by two categories ⇒ file once under the higher-severity
  category" rule — keeping the highest-severity, then highest-confidence,
  entry per group), and `filterFindings` (drops any `IGNORE`-severity or
  `confidence: "low"` finding).
- [`packages/review-bot/src/pipeline/run-review-bot.ts`](../../packages/review-bot/src/pipeline/run-review-bot.ts) —
  `runReviewBot(options)`: runs Explore once, narrows its output for each
  of the four reviewers (Step 6's `narrowFor*Review` functions), runs all
  four, and threads the combined raw findings through
  normalize → deduplicate → filter.

No existing file's *behavior* was changed to make these tests pass — this
was pure addition, wired into the existing Step 5/6 modules through their
already-published exports (`runExplore`, `reviewLogic`, `reviewTestCoverage`,
`reviewSecurity`, `reviewStyle`, `narrowFor*Review`).

## Step 5–6: run again, confirm passing

```
$ pnpm --filter @lead-radar/review-bot run test -- run-review-bot pipeline
```

Actual output (unedited, relevant lines):

```
✓ src/pipeline/pipeline.spec.ts (7 tests) 19ms
✓ src/pipeline/run-review-bot.spec.ts (2 tests) 4469ms
  ✓ runReviewBot — core benchmark-style behavior > flags a seeded-style
    logic bug, an untested code path, and a hardcoded secret; stays
    silent on clean code and unrelated files  3205ms
  ✓ runReviewBot — core benchmark-style behavior > filters a
    low-confidence finding that a reviewer would otherwise produce  1261ms

 Test Files  12 passed (12)
      Tests  77 passed (77)
```

All 12 test files (10 pre-existing + 2 new) pass; 77/77 tests (68
pre-existing + 9 new: 1 for `normalizeFindings`, 3 for
`deduplicateFindings`, 3 for `filterFindings`, 2 end-to-end).

## How each of the 9 requirements is actually verified

| # | Requirement | Where | How |
|---|---|---|---|
| 1 | Seeded-style logic bug flagged | `run-review-bot.spec.ts` | A hermetic repo with a `getLevel` boundary-comparison change (DEFECT-1's shape); asserts a `logic-error` finding on that file |
| 2 | Meaningful untested code path flagged | `run-review-bot.spec.ts` | A new `if` branch added to a function with an untouched test file (DEFECT-2's shape); asserts a `missing-tests` finding |
| 3 | Hardcoded synthetic secret flagged | `run-review-bot.spec.ts` | A credential-shaped fallback literal next to an `apiKey`-named field (DEFECT-3's shape); asserts a `security` finding whose evidence contains the literal |
| 4 | Clean change NOT flagged | `run-review-bot.spec.ts` | A trivial, fully-tested comment-only change to `util.ts`; asserts **zero** findings reference that file |
| 5 | Required structured schema | both spec files | Every finding is asserted to carry all 11 fields (`id`, `source`, plus the rubric's 9); `pipeline.spec.ts` additionally checks `normalizeFindings`'s output shape directly |
| 6 | Severity follows the rubric | `run-review-bot.spec.ts` | Asserts the logic and security findings are `MUST-FIX` and the missing-tests finding is `SHOULD-FIX` — matching the ground truth's own severities for these defect shapes |
| 7 | Duplicate findings removed | `pipeline.spec.ts` | Three dedicated `deduplicateFindings` tests: overlapping-location findings collapse to the higher-severity one; non-overlapping findings never collapse; a severity tie breaks on confidence |
| 8 | Low-confidence findings filtered | `pipeline.spec.ts` + `run-review-bot.spec.ts` | Unit tests prove `filterFindings` drops `confidence: "low"`/`IGNORE` and keeps `medium`/`high`; the end-to-end test additionally proves this through the *real* pipeline — a large-flat-block change that would produce a real `confidence: "low"` Style finding (verified directly against `reviewStyle` in Step 6's own tests) produces **zero** findings once run through `runReviewBot` |
| 9 | No unrelated unchanged code reported | `run-review-bot.spec.ts` | An untouched file (`src/untouched-secret.ts`) containing an obvious, real-looking hardcoded key is deliberately left out of the diff; asserts it never appears in any finding, and that every finding's `file` is a member of the diff's actual changed-file set |

## Regression after this step

```
$ pnpm --filter @lead-radar/review-bot run typecheck   → clean
$ pnpm --filter @lead-radar/review-bot run lint         → clean
$ pnpm --filter @lead-radar/review-bot run test         → 12 files, 77/77 passing
$ pnpm -r run lint                                       → clean, all 5 workspaces
$ pnpm -r run typecheck                                  → clean, all 6 workspaces
$ pnpm --filter @lead-radar/providers run test           → 209/209
$ pnpm --filter worker run test                          →  18/18
$ pnpm --filter api run test                              →  36/36
                                                              ─────────
                                                     total:   340/340
```

No result above is fabricated — these are the literal totals from the
actual runs, including the genuine pre-implementation failure captured in
Step 2–3 above.
