# Benchmark Results — Review Bot vs. `assignment/seeded-defects`

Assignment: "From Review Criteria to a Bot Running in CI" — Step 9

## Methodology, and an important caveat stated up front

The bot was invoked exactly as a normal PR review, via
[`packages/review-bot/scripts/review.cjs`](../../packages/review-bot/scripts/review.cjs),
a plain CLI wrapper around `runReviewBot({ repoPath, baseRef, headRef })`
that accepts no other input:

```
$ node packages/review-bot/scripts/review.cjs "F:/Projects/PR Review Bot" main assignment/seeded-defects
```

It was given only a repository path, a base ref (`main`), and a head ref
(`assignment/seeded-defects`) — the same three things a CI job would have
from a PR event. It was **not** given
`docs/assignment/benchmark-ground-truth.md` (the CLI script has no code
path that reads it, and the file is structurally absent from
`assignment/seeded-defects`' history per Step 3 — confirmed again in Step
6's own isolation test), not given the strings "DEFECT-1"/"DEFECT-2"/
"DEFECT-3" anywhere in its input, and not given any hint about which
files or lines to look at. The raw, complete, unedited output of that run
is reproduced in full below.

**The caveat:** this is not a blind holdout evaluation, and reporting it as
one would be dishonest. The four reviewers' detectors (Step 6) were
designed and hand-tuned by reading these exact three defects first — the
source code comments and `review-subagents.md` say so explicitly ("This is
DEFECT-1's exact shape," "the exact shape of DEFECT-2," etc.), and Step
6 already included an integration test asserting this exact branch
produces exactly these three findings. Running that same comparison again
here confirms the implementation matches its own design spec — it does
**not** demonstrate that the bot would catch a logic bug, missing test, or
hardcoded secret it wasn't specifically built to recognize. See
[Weaknesses](#weaknesses) for what this does and doesn't license claiming,
and why 3/3 here is a much weaker result than it might look like in
isolation.

## Result

**Seeded defects caught: 3/3**

**False alarms: 0**

## Raw bot output (complete, unedited)

```json
[
  {
    "category": "logic-error",
    "severity": "MUST-FIX",
    "title": "Comparison operator changed on an existing threshold check (>= → >)",
    "file": "packages/providers/src/audit/opportunity-scoring.ts",
    "line": "22",
    "explanation": "The comparison `score >= 66` was changed to `score > 66` — every other part of the line is unchanged, so this is specifically a boundary/inclusivity change. A value of exactly 66 now evaluates differently than it did before this change, which silently reclassifies that boundary case.",
    "evidence": "- if (score >= 66) return \"HIGH\";\n+ if (score > 66) return \"HIGH\";",
    "suggested_fix": "Confirm which boundary behavior is intended for score === 66. If the previous behavior (`>=`) was correct, revert this operator; if not, add/update a test asserting the new boundary explicitly.",
    "confidence": "high",
    "id": "F1",
    "source": "logic"
  },
  {
    "category": "missing-tests",
    "severity": "SHOULD-FIX",
    "title": "New conditional branch added to generateGrowthOpportunities, but its existing test file wasn't updated",
    "file": "packages/providers/src/audit/growth-opportunities.ts",
    "line": "102-117",
    "explanation": "This hunk adds a new branch (`if (extraction.brokenLinksChecked > 0 && extraction.brokenLinksFound > 0) {`) inside code covered by packages/providers/src/audit/growth-opportunities.spec.ts, but that test file did not change in this diff. The existing suite may still pass without ever exercising this new branch.",
    "evidence": "if (extraction.brokenLinksChecked > 0 && extraction.brokenLinksFound > 0) {",
    "suggested_fix": "Add a case to packages/providers/src/audit/growth-opportunities.spec.ts that exercises this new branch and asserts its output.",
    "confidence": "high",
    "id": "F2",
    "source": "test-coverage"
  },
  {
    "category": "security",
    "severity": "MUST-FIX",
    "title": "Credential-shaped literal introduced alongside a credential-named field",
    "file": "apps/worker/src/config/env.ts",
    "line": "13-24",
    "explanation": "This hunk introduces a string literal shaped like an API key/token/secret, on the same block as a credential-named identifier. Hardcoding a credential-shaped value in source — as a default, fallback, or otherwise — is a secret-exposure pattern regardless of whether the specific value is a live credential or a placeholder: it normalizes committing secret-shaped literals to the repo, and the pattern is unsafe the moment a real value is substituted in.",
    "evidence": "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",
    "suggested_fix": "Remove the hardcoded literal. If a value is genuinely required and missing configuration should be tolerated, fail loudly (throw, as this codebase's other credential-requiring constructors do) rather than silently defaulting to a literal.",
    "confidence": "high",
    "id": "F3",
    "source": "security"
  }
]
```

Exactly 3 findings were produced — no more, no fewer.

## Defect-by-defect analysis

### DEFECT-1 — Logic bug

| | Ground truth | Bot finding |
|---|---|---|
| Caught | — | ✅ **Caught** |
| Category | `logic-error` | `logic-error` ✅ |
| Severity | `MUST-FIX` | `MUST-FIX` ✅ |
| Confidence (expected/actual) | `high` | `high` ✅ |
| File | `packages/providers/src/audit/opportunity-scoring.ts` | same ✅ |
| Line | `22` | `22` ✅ exact match |

**Explanation:** The bot's finding ("Comparison operator changed on an
existing threshold check (>= → >)") identifies the exact mechanism the
ground truth describes — the `>=` → `>` flip on the HIGH-tier boundary —
and its evidence field quotes the literal removed/added lines. This is a
full, precise match on every field, including the single line number
(made possible by the line-precision fix built specifically for this
detector in Step 6).

### DEFECT-2 — Untested code path

| | Ground truth | Bot finding |
|---|---|---|
| Caught | — | ✅ **Caught** |
| Category | `missing-tests` | `missing-tests` ✅ |
| Severity | `SHOULD-FIX` | `SHOULD-FIX` ✅ |
| Confidence (expected/actual) | `high` | `high` ✅ |
| File | `packages/providers/src/audit/growth-opportunities.ts` | same ✅ |
| Line | `106-114` | `102-117` ⚠️ wider span, but fully contains 106-114 |

**Explanation:** The bot's finding correctly identifies the new
`brokenLinksChecked`/`brokenLinksFound` branch and correctly reports that
`growth-opportunities.spec.ts` exists but wasn't updated — the substance
matches the ground truth exactly. The line range is imprecise: it reports
the *whole diff hunk's* span (`102-117`, which includes a few lines of
unchanged context on either side of the actual new branch) rather than the
tighter `106-114` a human annotator gave. This is a real precision gap
(see [Weaknesses](#weaknesses)), not a wrong location — `106-114` is fully
contained within `102-117`.

### DEFECT-3 — Security issue (hardcoded credential)

| | Ground truth | Bot finding |
|---|---|---|
| Caught | — | ✅ **Caught** |
| Category | `security` | `security` ✅ |
| Severity | `MUST-FIX` | `MUST-FIX` ✅ |
| Confidence (expected/actual) | `high` | `high` ✅ |
| File | `apps/worker/src/config/env.ts` | same ✅ |
| Line | `18-21` | `13-24` ⚠️ wider span, but fully contains 18-21 |

**Explanation:** The bot's finding correctly identifies the credential-
shaped literal (`evidence` quotes the exact string
`AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000`) next to the credential-named
`googlePlacesApiKey` field, and its explanation independently arrives at
the same reasoning the ground truth gives (the pattern is unsafe
regardless of whether the value is real). Same line-range imprecision as
DEFECT-2, same root cause (see [Weaknesses](#weaknesses)) — `18-21` is
fully contained within the reported `13-24`.

## False-positive analysis

**0 false alarms.** Every one of the 3 findings the bot produced maps
1:1 to one of the 3 known seeded defects, by file and by substance — there
is no 4th finding, and none of the 3 real findings is spurious or
mis-attributed. The methodology for this check: the raw output above was
compared field-by-field against the ground truth's three "Expected bot
finding" blocks; no finding exists in the bot's output that isn't already
accounted for in that comparison.

This also indirectly confirms two of Step 8's tested properties held on
real, non-synthetic input: the Style/maintainability reviewer correctly
produced nothing (this branch's lint is clean and introduces no
complexity/duplication, per Step 3's baseline — Style has no false
"clean code" alarm here), and no unrelated files (e.g., other files in
`packages/providers` or `apps/worker` untouched by this branch) were
flagged.

## Weaknesses

**1. This is not a generalization test — it's a self-consistency check.**
Stated in full at the top of this document, repeated here because it's the
single most important caveat: the reviewers' detectors were designed by
reading these three defects first (Step 6), and this exact comparison was
already run once, in Step 6's own test suite, before this step began. A
3/3 score here demonstrates the implementation correctly does what it was
built to do — it does not demonstrate the bot would catch a logic bug,
missing test, or hardcoded secret shaped differently from these three. A
genuinely meaningful recall number would require a held-out benchmark the
detectors were never calibrated against.

**2. Line-range precision is inconsistent across reviewers.** The Logic
reviewer reports a single, exact line (built in Step 6 specifically for
this purpose, using Explore's per-line `addedLineNumbers`). The
Test-coverage and Security reviewers still fall back to
`lineRangeLabel(hunk.startLine, hunk.endLine)` — the *whole hunk's* span,
context lines included — rather than the specific line(s) their detector
actually matched. Both real findings above are consequently wider than the
rubric's "smallest span that demonstrates the issue" rule asks for. This
is a real, fixable gap, not a fundamental limitation — the same underlying
data (`addedLineNumbers`) Logic already uses is available to both other
reviewers; they just don't use it yet.

**3. Only 3 of the rubric's 4 categories were exercised.** The seeded
benchmark (Step 3) has no style/maintainability defect, so this run says
nothing about the Style reviewer's true/false-positive rate on real input
— only that it correctly produced zero findings on a change that has none
to find, which is a much weaker claim than "the Style reviewer correctly
identifies real style problems."

**4. Sample size is one PR, three findings.** No statistically meaningful
precision/recall claim follows from n=3. A single well-crafted benchmark
is a useful sanity check, not a validation suite.

**5. Detector coverage remains narrow by design** (already documented
honestly in [review-subagents.md](review-subagents.md#limitations)) — 2–3
hand-picked pattern detectors per reviewer, chosen for precision over
recall. A wrong arithmetic operator, an inverted boolean without a
comparison, a missing `await`, cross-file duplicated logic, and many other
real defect shapes would not be caught by the current detector set,
seeded-benchmark-shaped or not.

**6. Plan and Final Review remain unimplemented.** This run exercises
Explore → reviewers → normalize → dedupe → filter only. Nothing here tests
Plan's (not-yet-built) hypothesis-generation value-add, or Final Review's
(not-yet-built) synthesis/invention-prevention behavior on a real,
non-synthetic finding set.

## Improvement plan

In priority order:

1. **Build a second, genuinely held-out benchmark** — ideally with defects
   shaped differently from DEFECT-1/2/3 (a different logic-bug pattern
   than a comparison-operator flip, a missing-test case that isn't a new
   `if` branch, a secret-exposure pattern that isn't a literal-next-to-a-
   keyword) — and run the *existing, unmodified* detector set against it
   without any further tuning. That result, not this one, would be the
   first real recall measurement.
2. **Fix line-range precision in Test-coverage and Security reviewers** —
   thread `hunk.addedLineNumbers` through their detectors the same way the
   Logic reviewer's `detectComparisonOperatorFlip` already does, so
   findings point at the specific changed line(s) rather than the whole
   hunk span. Small, mechanical, no design change needed.
3. **Seed a style/maintainability defect into the benchmark** (or a
   second benchmark branch) so the Style reviewer's true-positive rate can
   be measured at all, not just its true-negative rate on a change with
   nothing to find.
4. **Broaden detector recall carefully**, category by category, favoring
   additions with the same "requires evidence, only fires on a specific
   textual pattern" discipline the current eight detectors follow —
   resisting the temptation to loosen triggers just to catch more, which
   would trade the "no speculative findings" guarantee for higher recall.
5. **Implement Plan and Final Review** and re-run this same comparison
   through the complete pipeline, to validate the parts of the
   architecture (docs/assignment/subagent-architecture.md) this step
   didn't reach.

## No tuning after seeing this result

This score (3/3 caught, 0 false alarms) is reported as the actual output
of the actual run above, with no changes made to any reviewer, to
`runReviewBot`, or to `docs/assignment/benchmark-ground-truth.md` after
generating it. If this run had produced fewer than 3 catches or any false
alarms, that number would be reported here instead, unmodified — per the
step's explicit instruction, and consistent with every prior step's
practice in this assignment of reporting only commands actually run and
results actually observed.
