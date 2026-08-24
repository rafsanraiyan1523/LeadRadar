# Benchmark Ground Truth — `assignment/seeded-defects`

Assignment: "From Review Criteria to a Bot Running in CI" — Step 3

⚠️ **This document is the answer key for the seeded benchmark PR. It exists
only on the `main` branch and is deliberately never committed to
`assignment/seeded-defects`, so it is not present when that branch is
checked out and cannot appear in a diff between the two branches. Do not
feed this file to the review bot, and do not commit it (or cherry-pick /
merge it) onto `assignment/seeded-defects` or any branch/PR the bot will
review.**

## Benchmark branch

- Branch: `assignment/seeded-defects`, based on `main` at commit `a737641`
  ("fix: add openssl for prisma alpine runtime").
- 3 commits, each seeding exactly one defect:
  1. `5f966ab` — "Tighten HIGH opportunity threshold boundary" → DEFECT-1
  2. `bfdb50d` — "Surface broken links found during crawl as a growth opportunity" → DEFECT-2
  3. `430686a` — "Default the Google Places API key for local/dev setups" → DEFECT-3
- Diff vs `main`: exactly 3 files changed, 17 insertions, 3 deletions (verified via `git diff --stat main assignment/seeded-defects`). No other files are touched.
- Commit messages are written as plausible, innocuous PR descriptions — they
  do not hint that a defect is being introduced. This is intentional: it
  keeps the benchmark realistic for a bot that reads commit messages/diffs.

## DEFECT-1 — Logic bug

- **Category:** Logic errors (rubric §1)
- **Severity per rubric:** **MUST-FIX** — the incorrect output is reachable
  on the golden path (any lead legitimately scoring exactly 66, the
  documented HIGH cutoff, is silently misclassified), not an edge case.
- **File:** `packages/providers/src/audit/opportunity-scoring.ts`
- **Line:** 22
- **What changed:** `if (score >= 66) return "HIGH";` → `if (score > 66) return "HIGH";`
- **Why it is a defect:** `getOpportunityLevel`'s own docstring/tests treat
  66 as the inclusive HIGH threshold (see the adjacent, unchanged
  `if (score >= 33) return "MEDIUM"` using `>=`, and the existing
  parameterized test asserting `66 → "HIGH"`). Changing only the HIGH
  branch to a strict `>` makes a score of exactly 66 fall through to the
  `>= 33` branch and be classified `"MEDIUM"` instead of `"HIGH"`. This
  silently mis-tiers real leads at the boundary value — no crash, no error,
  just a wrong business classification that flows into `computeOpportunityScore`
  and anything downstream that branches on `level` (e.g. `docs/scoring.md`'s
  worked examples, and any UI/sorting that treats HIGH specially).
- **How it can be verified:**
  - Run `pnpm --filter @lead-radar/providers run test`. Result on this
    branch: `Test Files 1 failed | 23 passed (24)`, `Tests 1 failed | 208
    passed (209)`, failing test:
    `src/audit/opportunity-scoring.spec.ts > getOpportunityLevel > maps
    score 66 to HIGH` — `expected 'MEDIUM' to be 'HIGH'`.
  - Or directly: `getOpportunityLevel(66)` returns `"MEDIUM"` on this
    branch vs. `"HIGH"` on `main`.
  - The existing test file (`opportunity-scoring.spec.ts`) was **not**
    modified to accommodate this — it still asserts the original, correct
    boundary, which is what makes it fail.
- **Expected bot finding:**
  - category: `logic-error`
  - severity: `MUST-FIX`
  - file/line: `packages/providers/src/audit/opportunity-scoring.ts:22`
  - gist: the HIGH-tier comparison was changed from `>=` to `>`, silently
    reclassifying a score of exactly 66 from HIGH to MEDIUM; inconsistent
    with the unchanged `>=` on the MEDIUM branch immediately below and with
    the existing test asserting `66 → HIGH`.
  - confidence: `high` (directly demonstrable by reading the diff and the
    existing test file, no external assumptions needed)

## DEFECT-2 — Untested code path

- **Category:** Missing tests / untested code paths (rubric §2)
- **Severity per rubric:** **SHOULD-FIX** — new behavior in an audit/scoring
  path (an "important path" per the rubric) with no added/updated test; the
  code itself is correct, so this is not a Category 1/3 finding.
- **File:** `packages/providers/src/audit/growth-opportunities.ts`
- **Lines:** 106–114 (new block)
- **What changed:** added a new finding branch —
  ```ts
  if (extraction.brokenLinksChecked > 0 && extraction.brokenLinksFound > 0) {
    findings.push({
      title: "Broken links found during crawl",
      category: "technical",
      severity: "MEDIUM",
      evidence: `${extraction.brokenLinksFound} of ${extraction.brokenLinksChecked} checked links failed to load.`,
      recommendation: "Fix or remove broken links — they erode visitor trust and can hurt SEO crawlability.",
    });
  }
  ```
  using the `brokenLinksChecked`/`brokenLinksFound` fields that already
  exist on `WebsiteExtraction` (populated by the crawler) but were
  previously never read anywhere in `generateGrowthOpportunities`.
- **Why it is a defect (for benchmark purposes):** the code is correct and
  low-risk on its own, but no test in
  `packages/providers/src/audit/growth-opportunities.spec.ts` was added or
  updated to cover it. The shared test fixture
  (`packages/providers/src/audit/test-utils.ts` → `buildExtraction()`)
  defaults `brokenLinksFound: 0`, so none of the 5 existing tests exercise
  this branch at all — it is reachable in production (any real crawl that
  finds ≥1 broken link) but has zero test coverage. This matches the
  rubric's Category 2 exactly: "new... behavior... has no added or updated
  test," on an audit-signal path the rubric explicitly calls out as
  "important."
- **How it can be verified:**
  - `pnpm --filter @lead-radar/providers run test` — all 5 existing tests
    in `growth-opportunities.spec.ts` still pass unchanged (this branch
    never fires under any existing fixture), confirming zero coverage
    rather than a failure.
  - Search the diff/PR for test changes: `git diff main assignment/seeded-defects -- '*.spec.ts'` touches no test file for this change (compare to DEFECT-1, which int
entionally has no test *file* change either, but there an existing test already covers the changed line — here, no test covers the new lines at all, at any point).
  - Manually: call `generateGrowthOpportunities` with an `extraction` where
    `brokenLinksChecked: 5, brokenLinksFound: 2` and observe the new
    finding is produced — there is no such call anywhere in the test suite.
- **Expected bot finding:**
  - category: `missing-tests`
  - severity: `SHOULD-FIX`
  - file/line: `packages/providers/src/audit/growth-opportunities.ts:106-114`
  - gist: new "broken links" finding branch added, using previously-unused
    `brokenLinksChecked`/`brokenLinksFound` signals, with no test in
    `growth-opportunities.spec.ts` (or elsewhere) exercising it — the
    shared `buildExtraction()` fixture defaults `brokenLinksFound: 0`, so
    this branch is untouched by the existing suite.
  - confidence: `high`

## DEFECT-3 — Security issue (hardcoded credential)

- **Category:** Security problems (rubric §3)
- **Severity per rubric:** **MUST-FIX** — a credential-shaped secret is
  committed directly into source.
- **File:** `apps/worker/src/config/env.ts`
- **Lines:** 18–21
- **What changed:**
  ```ts
  // before
  googlePlacesApiKey: process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY,

  // after
  googlePlacesApiKey:
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.GOOGLE_PLACES_API_KEY ??
    "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",
  ```
- **Why it is a defect:** a third fallback was added that hardcodes a
  credential-shaped literal directly in source, used whenever neither env
  var is set. This is a textbook hardcoded-secret anti-pattern: even though
  this specific value is a synthetic, obviously-fake placeholder (see
  "Synthetic value" below — **it is not a working credential and never
  was**), the *pattern* introduced — silently falling back to a
  string literal committed in the repo instead of failing loudly or staying
  unset — is exactly what the rubric's Security category flags as MUST-FIX
  ("secrets committed in the diff"). In a real PR with a real key pasted in
  this position, this would leak a live credential into git history
  permanently. It also silently defeats the existing "fail safely" pattern
  used one function away (`requireEnv`, line 3-9 of the same file, which
  throws loudly on a missing required var) and the sibling constructors in
  `GooglePlacesProvider`/`ExternalAIProvider`, which both explicitly throw
  rather than default when their API key is missing.
- **Synthetic value used (confirmed NOT a real credential):**
  `AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000` — shaped like a Google API key
  (`AIza` prefix, correct rough length) but contains the literal substrings
  `BENCHMARK`, `FAKE`, and `DO0NOT0USE`, making it unambiguous on sight that
  it is a placeholder, per the assignment's explicit safety requirement.
- **How it can be verified:**
  - Read the diff: `git diff main assignment/seeded-defects -- apps/worker/src/config/env.ts` shows the literal string directly.
  - `pnpm --filter worker run test` — all 18 existing tests still pass
    (0 tests reference `googlePlacesApiKey`'s value directly, and no test
    sets a truthy `googlePlaceId` that would route through the
    `GooglePlacesProvider` construction path in
    `lead-enrichment.processor.ts`), confirming this defect is a pure
    security/hygiene issue, not something that happens to also break tests.
  - Grep for the pattern: `grep -rn "AIzaSy" apps/worker/src` finds the
    hardcoded literal.
- **Expected bot finding:**
  - category: `security`
  - severity: `MUST-FIX`
  - file/line: `apps/worker/src/config/env.ts:18-21`
  - gist: a credential-shaped string literal was added as a silent fallback
    for `GOOGLE_MAPS_API_KEY`/`GOOGLE_PLACES_API_KEY` instead of leaving the
    value unset/undefined (as it was before) or throwing like the
    sibling `requireEnv` helper and the `GooglePlacesProvider`/
    `ExternalAIProvider` constructors do; hardcoded secrets/credential-like
    literals must never be committed to source, regardless of whether the
    specific value happens to be real.
  - confidence: `high`

## Summary table

| ID | Category | Severity | File | Lines |
|---|---|---|---|---|
| DEFECT-1 | Logic error | MUST-FIX | `packages/providers/src/audit/opportunity-scoring.ts` | 22 |
| DEFECT-2 | Missing tests | SHOULD-FIX | `packages/providers/src/audit/growth-opportunities.ts` | 106–114 |
| DEFECT-3 | Security | MUST-FIX | `apps/worker/src/config/env.ts` | 18–21 |

## Baseline verification results on `assignment/seeded-defects`

All commands run exactly as CI invokes them, from this branch, after a
`pnpm run build:packages`:

| Check | Command | Result |
|---|---|---|
| `packages/providers` test | `pnpm --filter @lead-radar/providers run test` | ❌ 1 failing (`opportunity-scoring.spec.ts`, DEFECT-1) / 208 passing / 209 total, across 24 files |
| `apps/worker` test | `pnpm --filter worker run test` | ✅ 18/18 passing (DEFECT-3 does not break anything) |
| `apps/api` test (unit) | `pnpm --filter api run test` | ✅ 36/36 passing (untouched by this branch) |
| `packages/providers` lint | `pnpm --filter @lead-radar/providers run lint` | ✅ clean |
| `apps/worker` lint | `pnpm --filter worker run lint` | ✅ clean |
| `packages/providers` typecheck | `pnpm --filter @lead-radar/providers run typecheck` | ✅ clean |
| `apps/worker` typecheck | `pnpm --filter worker run typecheck` | ✅ clean |
| `build:packages` | `pnpm run build:packages` | ✅ clean |
| apps build | `pnpm -r --filter "./apps/*" run build` | ✅ clean (api, web 19 routes, worker all succeed) |

Notes:

- `pnpm -r run test` from repo root bails out after the first failing
  workspace (pnpm's default recursive behavior), so it stops at
  `packages/providers` and never reaches `apps/api`/`apps/worker` in a
  single invocation — the per-package runs above give the complete,
  accurate picture instead of relying on that aggregate command's exit code
  alone.
- `apps/web`'s standalone `typecheck` script still fails on this branch —
  this is the **pre-existing, unrelated** `LayoutProps` defect documented in
  `docs/assignment/step-1-repository-preparation.md` (present on `main` and
  on every historical CI run before this branch existed). This branch does
  not touch `apps/web` at all; do not attribute this to the seeded
  benchmark defects.
- Exactly one test fails (the DEFECT-1 boundary case). No other test,
  lint, typecheck, or build regressions were introduced. No existing test
  file was modified.

## Confirmation: exactly three defects, nothing else

- `git diff --stat main assignment/seeded-defects` → 3 files changed
  (`apps/worker/src/config/env.ts`,
  `packages/providers/src/audit/growth-opportunities.ts`,
  `packages/providers/src/audit/opportunity-scoring.ts`), 17 insertions,
  3 deletions. No other file in the repository differs from `main`.
- No test file was edited on this branch.
- No `.env`/config/secret files outside the one intentional literal in
  DEFECT-3 were touched.
- Application functionality otherwise fully builds, lints, and (aside from
  the one intentionally-seeded failing test) tests green — the project
  remains reviewable and runnable end-to-end.
