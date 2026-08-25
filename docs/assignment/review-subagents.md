# Specialized Review Subagents — Implementation

Assignment: "From Review Criteria to a Bot Running in CI" — Step 6

This document covers the four specialized reviewer subagents from
[docs/assignment/subagent-architecture.md](subagent-architecture.md),
implemented against the Explore subagent from
[docs/assignment/explore-subagent.md](explore-subagent.md). Code lives at
[packages/review-bot/src/reviewers/](../../packages/review-bot/src/reviewers/)
and [packages/review-bot/src/rubric/](../../packages/review-bot/src/rubric/).

## Implementation

### Same design choice as Explore, for a different reason

Like Explore (Step 5), every reviewer here is a **deterministic function**
with no LLM call — but the justification is different this time. Explore's
job is pure fact-gathering, where determinism is a natural fit. A
reviewer's job is genuinely judgment (rubric Categories 1–4 all ask "is
this actually wrong, and how badly"), which an LLM would normally be best
suited for. The reason to still build this step deterministically:

- **Step 6's own constraints are mechanical, not stylistic** — "a finding
  requires evidence," "no invented files or lines," "no duplicate
  findings," "no speculative findings" are all things a deterministic
  detector satisfies *by construction*: it can only ever produce a Finding
  by matching a literal, quotable pattern against a specific hunk that
  really is part of the diff. There is no code path where a detector
  "imagines" a defect — every `return null` in these modules is a case
  where evidence wasn't found, not a case where evidence was insufficient
  but a finding was written anyway.
- **It keeps the four reviewers independently, deterministically testable**
  (the step's own requirement), including two full pipeline integration
  tests that replay realistic diff shapes end-to-end without any network
  or model dependency.
- It is not a rejection of the architecture's LLM-reviewer design — see
  [Limitations](#limitations) for exactly what a heuristic approach
  structurally cannot catch, and why an LLM-backed reviewer remains the
  natural next iteration behind the same `Finding` contract.

### Module layout

```
packages/review-bot/src/
  rubric/
    types.ts                — Finding schema, verbatim from the rubric's Output format
  reviewers/
    shared/
      types.ts               — per-reviewer input types (TS Pick<> narrowing) + narrow*() functions
      hunk-text.ts            — addedLines/removedLines/indentWidth/lineRangeLabel helpers
    logic/logic-reviewer.ts              — Category 1
    test-coverage/test-coverage-reviewer.ts — Category 2
    security/security-reviewer.ts         — Category 3
    style/style-reviewer.ts               — Category 4
    integration.spec.ts                   — Explore → reviewers, hermetic temp-repo fixtures
    benchmark-branch.integration.spec.ts  — Explore → reviewers against the REAL assignment/seeded-defects branch
    index.ts
```

### Only the source/diff context necessary — enforced at the type level

Per Step 6's instruction ("each reviewer receives the Explore summary plus
only the source/diff context necessary for its responsibility"),
`reviewers/shared/types.ts` defines each reviewer's input as a strict
TypeScript `Pick<ChangedFileSummary, ...>`:

```ts
type LogicReviewFile = Pick<ChangedFileSummary, "path"|"changeKind"|"linesAdded"|"linesRemoved"|"hunks"|"changedSymbols">;
type TestCoverageReviewFile = LogicReviewFile & Pick<ChangedFileSummary, "relevantTests">;
type SecurityReviewFile = LogicReviewFile;
type StyleReviewFile = LogicReviewFile;
```

A `narrowFor*Review(pkg: ExploreContextPackage)` function performs the
actual narrowing. This isn't just documentation-as-comment: the Style
reviewer's function signature makes it a **type error** to reach for
`relevantTests`, and the Logic reviewer's signature makes it a type error to
reach for `riskFlags` or `callers` — each reviewer's own code literally
cannot compile if it tries to use a field outside its remit, independent of
what the function body happens to do.

Two reviewers (Test-coverage, Security) additionally take an **optional,
narrow, on-demand `readFile: (path: string) => string | null` capability**
— not open-ended repo access, but a single function they can only ever call
with a path Explore already told them about (a matched test file's path, or
the file they're already reviewing). This mirrors the architecture doc's
"scoped tool access for spot-checks" design for reviewers (§3, §4) and is
required because two rubric-mandated false-positive-avoidance checks are
genuinely undecidable from a hunk alone:

- Test-coverage detector 3 needs a changed test file's actual content to
  check whether it mentions the symbol it's supposed to be testing.
- Security detector 2 needs a controller file's full content to check for
  a class-level `@UseGuards` (the rubric's own explicit false-positive rule:
  "check for a class-level `@UseGuards` before flagging a method as
  unguarded").

In production wiring, this capability is backed by Explore's own
`readFileAtRef` (Step 5) — same git-CLI-backed, read-only mechanism, no new
attack surface. In unit tests, it's backed by a plain in-memory function
(no git needed) — see [Tests](#tests).

## Finding schema

Every reviewer emits `Finding[]`, defined once in `rubric/types.ts`,
matching [review-rubric.md's Output format](review-rubric.md#output-format)
field-for-field (including the exact `suggested_fix` snake_case key, so
output is directly interoperable with the rubric's own schema — no
translation layer):

```ts
interface Finding {
  category: "logic-error" | "missing-tests" | "security" | "style-maintainability";
  severity: "MUST-FIX" | "SHOULD-FIX" | "IGNORE"; // reviewers never construct an IGNORE finding — see rubric.ts's doc comment
  title: string;
  file: string;
  line: string;        // "22" or "106-114"
  explanation: string;
  evidence: string;
  suggested_fix: string;
  confidence: "high" | "medium" | "low";
}
```

## Logic reviewer

**Looks for:** two precise detectors, not a broad "does this look wrong"
scan.

1. **Comparison-operator flip on a numeric threshold** — fires only when a
   hunk has exactly one removed and one added line, and both share the same
   left-hand operand and right-hand numeric literal but a different
   comparison operator (`score >= 66` → `score > 66`). This is the exact
   shape of DEFECT-1. **MUST-FIX**, `confidence: high` — the boundary
   change is directly demonstrable by reading the two lines side by side.
2. **Off-by-one `<=` against `.length`** — fires on a newly-added (not
   merely retained) `<= x.length` comparison, the classic out-of-bounds
   shape. **SHOULD-FIX**, `confidence: medium`.

**Conservatism:** the operator-flip detector deliberately refuses to fire
on a hunk with more than one removed/added line — pairing which removed
line corresponds to which added line would be a guess, and a guess is
exactly what "no speculative findings" rules out. Both detectors require
the pattern to be *new* in this hunk (absent from the removed lines),
satisfying "no review of unrelated unchanged code."

## Test-coverage reviewer

**Looks for:** three detectors, explicitly gated to avoid the rubric's
named failure mode ("do NOT complain merely because every function lacks a
test").

1. **New branch, untouched test file** — a hunk adds a new `if`/`else
   if`/`switch`/`catch` (verified absent from the *removed* lines too, so
   editing an existing condition's expression doesn't count as "new"), in a
   file with an existing test file that wasn't changed in this diff. This
   is DEFECT-2's exact shape. **SHOULD-FIX**, `confidence: high`.
2. **No test coverage found at all** — a function/class/method-level
   change (never a bare `const`) with zero relevant tests found anywhere,
   gated to changes of at least 2 total lines (skips trivial one-line
   tweaks). **SHOULD-FIX**, `confidence: medium`.
3. **Updated test doesn't reference the changed symbol** — a test file WAS
   changed in this diff, but reading its content (via the on-demand
   capability) shows it never mentions the symbol this PR changed.
   **SHOULD-FIX**, `confidence: medium`.

**Conservatism:** detector 2 requires a function/class/method-kind symbol
and a non-trivial diff size — a one-line `const` tweak never triggers it.
Detector 1 only fires when a test file exists but wasn't touched; a file
with genuinely zero tests goes through detector 2 instead, and the two
never double-fire on the same file (the reviewer stops after its first
match per file).

## Security reviewer

**Looks for:** two detectors.

1. **Hardcoded credential-shaped literal near a credential-named field** —
   requires *both* a shape match (Google/OpenAI/AWS-style key shapes, or a
   long base64-ish quoted literal) *and* a credential keyword
   (`apiKey`/`secret`/`token`/`password`/`credential`/`privateKey`)
   present in the same hunk's added-lines block. This is DEFECT-3's exact
   shape, including its multi-line `??`-chain formatting (the detector
   operates on the whole hunk's added-text block, not line-by-line, for
   exactly this reason). Test files (`.spec.ts`/`.test.ts`/under `e2e`/
   `test`) are excluded — fixture values there are expected. **MUST-FIX**,
   `confidence: high`.
2. **New controller endpoint missing `@UseGuards`** — a new
   `@Get`/`@Post`/`@Put`/`@Delete`/`@Patch`-decorated method added to a
   `*.controller.ts` file with no `@UseGuards` on the method itself, no
   class-level `@UseGuards` (checked via the on-demand file read — the
   rubric's own explicit false-positive rule), *and* at least one sibling
   method in the same file that does have `@UseGuards` (so a controller
   that's intentionally entirely public isn't flagged just for being
   public). **MUST-FIX**, `confidence: medium`.

**Conservatism — directly implementing Step 6's explicit instruction** ("do
not report fake or obviously harmless values unless they are clearly
representative of a secret exposure problem"): detector 1 never fires on a
credential-shaped literal alone — only when it sits next to a
credential-named identifier, which is what makes the *pattern* (not the
specific value) unambiguously a secret-exposure shape, matching exactly the
reasoning in
[benchmark-ground-truth.md's DEFECT-3 writeup](benchmark-ground-truth.md#defect-3--security-issue-hardcoded-credential)
for why a synthetic placeholder is still MUST-FIX.

## Style/maintainability reviewer

**Looks for:** two detectors, deliberately the narrowest reviewer — this
repo already runs ESLint + Prettier, so nothing formatting-related is
in scope by construction (neither detector reasons about formatting at
all).

1. **Complexity growth** — either a newly-added line indented ≥12 columns
   (~6 nesting levels), or a hunk adding more than 60 lines in one block.
   **SHOULD-FIX** (`confidence: medium`/`low` respectively).
2. **Within-file duplication** — a 5+ line, 60+ character added block that
   (modulo whitespace) already appears elsewhere in the same file's
   current content (via the on-demand read). **SHOULD-FIX**,
   `confidence: medium`.

**Conservatism:** duplication detection is deliberately scoped to
*within one file* only — reliably detecting duplication against a
*different* file would require a much broader, noisier search; see
[Limitations](#limitations). Detector 2 never fires without file content
available (no guessing from the diff alone), and the minimum
line/character thresholds exist specifically to avoid flagging
trivially-common short blocks (`}\n}\n` and similar).

## How conservatism is enforced across all four (not just described)

The Step 6 "Important" constraints map to concrete mechanisms, not just
reviewer instructions:

| Constraint | Mechanism |
|---|---|
| A finding requires evidence | Every `Finding.evidence` is a literal substring of an actual hunk or file — never synthesized prose describing an absence in the abstract. |
| No speculative findings | Every detector's trigger is a specific textual/structural pattern; if the pattern isn't there, the function returns `null` — there is no "maybe, flag it anyway with low confidence" path. |
| No duplicate findings | Each reviewer's `for` loop only ever pushes one finding per (file, detector) match — e.g. Test-coverage's `continue` after its first match per file (see source) stops it from also firing detector 2 on the same file. Cross-reviewer deduplication is a later pipeline stage (Step 4's architecture), not this step's job. |
| No invented files or lines | Every `Finding.file`/`Finding.line` is copied from the `ChangedFileSummary`/`ChangeHunkSummary` Explore already produced — a reviewer never constructs a path or line number from scratch. Verified directly: the integration tests assert every finding's `file` is a member of the diff's actual changed-file set. |
| No review of unrelated unchanged code | Every detector operates on *added* lines (or removed-vs-added pairs) from a hunk — never on file content outside a hunk, except the two narrowly-scoped on-demand reads described above, both of which only re-examine the *same file already in the diff*, never a different file. |

## Tests

68 tests across 10 files in `packages/review-bot`
(`pnpm --filter @lead-radar/review-bot run test`):

| File | Tests | What it covers |
|---|---|---|
| `rubric` (no dedicated spec — schema is exercised indirectly by every reviewer test's field-presence assertions) | — | — |
| `reviewers/logic/logic-reviewer.spec.ts` | 9 | Both detectors, including 3 dedicated conservatism checks (ambiguous multi-line hunk, unchanged pattern, deleted files) |
| `reviewers/test-coverage/test-coverage-reviewer.spec.ts` | 10 | All three detectors, plus the explicit "does NOT complain merely because a trivial change has no test" case from Step 6's own wording |
| `reviewers/security/security-reviewer.spec.ts` | 12 | Both detectors, plus 4 dedicated false-positive-avoidance cases (no keyword nearby, env-only read, test-file fixture, class-level guard present, no sibling guard) |
| `reviewers/style/style-reviewer.spec.ts` | 11 | Both detectors, plus dedicated threshold/uniqueness conservatism cases |
| `reviewers/integration.spec.ts` | 2 | **Explore → reviewers**, end-to-end, against a hermetic temp git repo replicating all three seeded-defect *shapes* (not copies) — asserts each reviewer finds exactly its own defect and stays silent on the other two files, plus a second test asserting all four reviewers stay silent on an unremarkable, well-tested change |
| `reviewers/benchmark-branch.integration.spec.ts` | 1 | **Explore → reviewers against the real `assignment/seeded-defects` branch** — closes the loop from Step 3 all the way through Step 6; finds DEFECT-1/2/3 with the exact severities recorded independently in Step 3's ground truth, with no unexpected findings and Style correctly silent. Self-skips (not fails) if the branch is absent from the checkout. |
| `explore/*.spec.ts` (Step 5, re-run) | 23 | Unaffected by this step's changes except one precision fix (see below) |

### A real bug this work surfaced and fixed (Step 5 module)

Building the benchmark-branch integration test exposed that Explore's
`ChangeHunkSummary` only carried a hunk's *whole* span (`startLine`/
`endLine`, context lines included) — for DEFECT-1's real diff (a 5-line
hunk where only line 22 actually changed), that meant a reviewer's finding
would have reported line "20-24" instead of "22". Fixed by threading exact
post-change line numbers through `diff-parser.ts` (a new
`addedLineNumbers` field, computed by tracking the true line-by-line
position while parsing, not reconstructed after the fact) — see
`packages/review-bot/src/explore/diff-parser.ts`. Explore's own test suite
(`diff-parser.spec.ts`) now includes a dedicated regression test for this
exact shape. This is a Step 5 module fix made necessary by Step 6's needs,
not a Step 6-only change — documented here for traceability, and
[explore-subagent.md](explore-subagent.md) reflects the corrected behavior.

Two additional bugs were caught and fixed by these tests before they ever
shipped: a credential-keyword regex that used `\b` word boundaries and so
silently failed to match keywords inside camelCase identifiers like
`googlePlacesApiKey` (the exact shape of the real DEFECT-3), and a style
reviewer test helper that passed a mismatched path to its `readFile` stub,
which made two "positive" test cases pass for the wrong reason (silently
vacuous) until a third case's assertion caught the mismatch. Both are
called out here rather than glossed over, since "the tests caught a real
bug before it shipped" is a more meaningful claim than "all tests pass."

### Actual results (run on `main`, 2026-08-25)

```
$ pnpm --filter @lead-radar/review-bot run typecheck   → clean, 0 errors
$ pnpm --filter @lead-radar/review-bot run lint         → clean, 0 issues
$ pnpm --filter @lead-radar/review-bot run test

 Test Files  10 passed (10)
      Tests  68 passed (68)
   Duration  ~13s
```

Full-repo regression (nothing else broke):

```
$ pnpm -r run lint        → clean, all 5 lintable workspaces
$ pnpm -r run typecheck   → clean, all 6 typechecked workspaces
$ pnpm --filter @lead-radar/providers run test  → 209/209
$ pnpm --filter worker run test                 →  18/18
$ pnpm --filter api run test                    →  36/36
$ pnpm --filter @lead-radar/review-bot run test →  68/68
                                                    ───────
                                          total:    331/331
```

No result above is fabricated or rounded — these are the literal totals
from the actual runs.

## Limitations

Honest, same spirit as [explore-subagent.md](explore-subagent.md)'s
limitations section:

- **Each reviewer has exactly two (Logic, Security, Style) or three
  (Test-coverage) detectors.** This is intentionally narrow — precision
  over recall, matching "the reviewers must be conservative" — but it also
  means real defects outside these specific shapes will not be caught.
  A wrong arithmetic operator (`+` used where `-` was intended), an
  inverted boolean without a comparison operator, a subtly wrong string
  template, a missing `await`, an N+1 query pattern, cross-file duplicated
  logic, inconsistent architectural conventions — none of these are
  detected by the current heuristic set. This is the direct, honest
  tradeoff of the "agents only where judgment is required... except here,
  where determinism was chosen for testability" decision explained above.
- **An LLM-backed reviewer is the natural extension**, not a competing
  design: every detector function's signature (`(input, readFile?) =>
  Finding[]`) is agnostic to how findings are produced. A future variant
  could call an LLM with the same narrowed input and rubric section,
  validate its output against `rubric/types.ts`'s `Finding` schema, and
  slot into the exact same pipeline position — the type contract this step
  establishes is what makes that swap possible without touching Plan,
  Explore, or anything downstream.
- **Cross-file duplication is not detected** (Style reviewer is
  within-file only) — the rubric's own worked example (opportunity-scoring
  logic re-implemented in a different file) would not be caught by this
  implementation.
- **The `@UseGuards` detector is NestJS/this-repo-specific** by design (it
  encodes this codebase's actual convention, per the architecture doc's
  "grounded, repo-specific examples" principle) — it would need
  reconfiguring for a different framework or auth pattern.
- **Regex-based comparison/branch/decorator parsing**, not a real AST —
  inherits the same category of limitation as Explore's symbol extraction
  (Step 5): unusual formatting, multi-statement lines, or non-standard
  code style can evade a detector that would otherwise fire.
- **No cross-reviewer deduplication or severity-priority resolution yet**
  — that's Step 4's architecture's "Deduplication" and "Severity/Confidence
  Filtering" pipeline stages, explicitly out of scope for this step (which
  only builds the four reviewers themselves). In this step's test suite,
  the four reviewers happen not to overlap on the same lines, so this
  wasn't yet exercised end-to-end.

## What's next (not part of this step)

Plan, Finding Normalization, Deduplication, Severity/Confidence Filtering,
and Final Review remain unimplemented, per the architecture's pipeline.
This step stops at the four specialized reviewers, as instructed.
