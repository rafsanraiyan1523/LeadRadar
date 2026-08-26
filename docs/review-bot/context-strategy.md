# Context Management Strategy

Assignment: "From Review Criteria to a Bot Running in CI" — Step 7

This document explains, concretely, how context flows through the review
bot pipeline built in Steps 5–6
([Explore](explore-subagent.md), [the four reviewers](review-subagents.md))
and designed in [Step 4](subagent-architecture.md), and how it stays
bounded regardless of how large the target repository or diff is. No code
changes were made in this step — this is a description of the actual,
already-implemented behavior (Explore, the reviewers) plus the designed
behavior of the pieces built in Step 4 but not yet implemented (Plan,
Final Review), clearly distinguished throughout.

**The organizing principle: context is a budget, not a convenience.**
Every stage below is described not just by *what* it passes forward, but by
*what it costs* and *what bounds that cost* — because the alternative
("just include more, to be safe") is what every other section in this
document argues against.

## 1. What enters the initial context

Not the repository. Not even the full diff text, at first. The pipeline's
actual entry point (`ExploreInput`, [explore-subagent.md](explore-subagent.md#inputoutput-format))
is just **coordinates**:

```ts
{ repoPath: string; baseRef: string; headRef?: string }
```

— a path to a checked-out working tree, plus two ref names (in CI: the
PR's base branch and head branch/SHA). That's it. Everything else Explore
needs, it goes and gets deliberately, one bounded git call at a time (see
§2). This matters: the "initial context" is O(1) regardless of repository
size — a 50-file PR and a 5,000-file monorepo both start from the same
few bytes.

If PR *metadata* (title, description, author) is available (from a GitHub
webhook, in a later step's CI wiring — not built yet), it would be added
here too, as a few more strings — still O(1), never something that scales
with repo size.

## 2. What the Explore subagent summarizes

Explore turns "coordinates" into the one artifact everything downstream is
built from: `ExploreContextPackage`. What it keeps, per changed file:

- **The diff's hunks — `+`/`-` lines only.** Context lines are dropped
  during parsing, before any truncation logic even runs (`diff-parser.ts`).
  A change on line 500 of a 2,000-line file never pulls lines 490–510 into
  the package just because they're nearby.
- **A per-hunk excerpt, capped** at `maxHunkExcerptLines` (default 12),
  with an explicit `"… (N more line(s) omitted)"` marker and a `truncated`
  flag rather than a silent cut (see §6–§7).
- **Symbol labels, not bodies** — `{name, kind, line}` triples for the
  exported function/class/interface/const a hunk falls inside, never the
  declaration's implementation.
- **Caller and test *paths***, found via `git grep` against the ref's
  tree directly (no per-file content pulled into memory to search it),
  capped at `maxCallers` (default 8) per file.
- **Risk flags** — short `{kind, description}` tags (`security-sensitive-
  path`, `no-relevant-test-found`, etc.), a sentence each, never a
  paragraph.
- **A one-line, mechanically-templated `purpose` string** per file (e.g.
  `"Touches function addNumbers across 1 hunk(s) (+1/-0 lines)."`).

For a concrete size comparison: `opportunity-scoring.ts` (the real
DEFECT-1 file) is ~112 lines (~3.4 KB). Its `ExploreContextPackage` entry
for that file's actual PR is a 2-line hunk excerpt (~70 bytes) plus a
handful of short strings — roughly two orders of magnitude smaller than
the file itself, and that ratio *improves*, not worsens, as the file grows
(the excerpt is capped at a fixed size; the file isn't).

## 3. What raw information is intentionally discarded

Explicitly, and by design, never present anywhere in `ExploreContextPackage`:

- **Full file contents.** `readFileAtRef` is called internally (to run
  symbol extraction against), but that content is never itself written
  into the output — verified directly by
  [explore-subagent.md's large-file test](explore-subagent.md#tests), which
  asserts a 300-line fixture's untouched content never appears anywhere in
  the serialized package.
- **Diff context lines** (unchanged lines shown for readability in a
  normal diff view) — dropped at parse time, not just truncated later.
- **Any file untouched by the diff.** Explore never walks "the repo" for
  its own sake — every file it reads is one already named by
  `git diff --name-status`, or a candidate `git grep` surfaced while
  searching for a *specific* symbol name already known to be relevant.
- **Git history/blame beyond the diff** — no commit log, no blame
  annotations, no prior-PR context.
- **Binary file contents** — detected and explicitly flagged as
  unsummarized rather than attempted.
- **Build/generated output** — `node_modules`, `dist`, `.next`,
  `packages/db/generated` are denylisted outright (see §8).
- **The benchmark ground-truth document** — denylisted by path as
  defense-in-depth on top of the structural guarantee that it isn't
  present in a seeded PR branch's history at all (Step 3, reaffirmed by
  the architecture doc's [ground-truth isolation](subagent-architecture.md#ground-truth-isolation)
  section and tested directly in Explore's own suite).

## 4. What gets passed to the Plan subagent

**Status: designed (Step 4), not yet implemented.** Per the architecture,
Plan receives the PR diff, Explore's *entire* `ExploreContextPackage`, and
the rubric — it is the one stage allowed to see the full package, because
its job is deciding how to slice it, not reviewing code itself. Plan's
output is four small **review briefs**, each carrying only the hunks/
context relevant to one category, plus specific hypotheses worth checking
(`subagent-architecture.md §2`).

**What exists today instead:** `reviewers/shared/types.ts`'s
`narrowFor*Review()` functions are a *static* stand-in for Plan's
field-narrowing half — each is a pure `Pick<>` projection of
`ExploreContextPackage` (no hypotheses, no prioritization, no dynamic
"this category looks low-relevance" judgment). This is called out
explicitly, not glossed over: the context-budget *shape* Plan would enforce
already exists and is already tested (each reviewer's input type
structurally cannot carry fields outside its remit); what's missing is
Plan's *judgment* layer on top of that shape (deciding what's worth
flagging as a hypothesis, not just what fields to include).

## 5. What each specialized reviewer receives

| Reviewer | Narrowed fields (`Pick<ChangedFileSummary, …>`) | On-demand extra |
|---|---|---|
| Logic | `path, changeKind, linesAdded, linesRemoved, hunks, changedSymbols` | none |
| Test-coverage | + `relevantTests` | `readFile(path)` — only for paths already in `relevantTests` |
| Security | same core fields as Logic | `readFile(path)` — only for the file already being reviewed, only for `*.controller.ts` |
| Style | same core fields as Logic | `readFile(path)` — only for the file already being reviewed |

None of the four ever receive `callers`, `potentiallyAffectedBehavior`,
`riskFlags`, `missingContext`, or `purpose` — those are Explore's own
narrative/summary fields, useful to a human or to Final Review's synthesis,
but not needed for a reviewer to apply its own rubric category, and
deliberately excluded to keep each reviewer's input to exactly what its
detectors use (`review-subagents.md`'s per-reviewer type tables document
this precisely).

Worth noting: reviewers do **not** receive Explore's `riskFlags` even
though they overlap conceptually (e.g. Explore's `possible-hardcoded-
secret` vs. the Security reviewer's own credential detector). This is
deliberate, not an oversight — each reviewer computes its own independent
signal rather than being handed Explore's lightweight heuristic flag as a
premise to rubber-stamp. Passing Explore's flag in as "context" would risk
anchoring the reviewer on Explore's (deliberately cheap, deliberately
imprecise) judgment instead of the reviewer doing its own, more rubric-
faithful check.

## 6. How large diffs are chunked

Three independent bounding mechanisms, all already implemented:

1. **Per-hunk excerpt cap** (`maxHunkExcerptLines`, default 12) — the
   single largest lever. A hunk that changes 200 lines in one block still
   contributes at most ~12 lines (plus a truncation marker) to the context
   package.
2. **Per-file independence.** Each `ChangedFileSummary` is built from that
   file's own diff, symbols, and grep results only — a 50-file PR costs
   *50× one file's processing*, not some combinatorial blow-up across
   files. Total context grows **linearly** with diff size, never
   super-linearly.
3. **Fan-out caps** (`maxCallers`, default 8) bound how much a single
   widely-referenced symbol can pull into one file's summary, regardless
   of how many places in the repo actually reference it.

**Not yet needed, and why:** there is no cross-file batching or
"process reviewers per file-group" mechanism, because none has been
necessary yet — since cost is already linear and each hunk is already
capped, a very large PR produces a large-but-bounded-per-unit context
package rather than an unbounded one. If a future real-world PR turns out
to have, say, 300 changed files, the natural next lever (not yet built) is
capping *changed files per Explore/reviewer call* the same way hunks are
capped per file — the architecture doesn't preclude this, it just hasn't
been required by anything built so far.

## 7. How summaries are compacted

Compaction happens by **replacing content with a smaller, structurally
equivalent fact**, not by lossy summarization of prose:

- A function's body → its `{name, kind, line}` label.
- A file's full diff → its hunks' `+`/`-` lines only, each capped.
- "This function is used elsewhere" → a list of file *paths* (not content).
- "This looks risky" → a `{kind, description}` tag from a fixed vocabulary,
  one sentence.
- "What changed here" (`purpose`) → a single templated sentence built from
  already-known facts (change kind, symbol names, hunk count, line counts)
  — never a generated summary that could drift from what's literally true,
  since it's constructed by template substitution, not free text
  generation.

The truncation marker (`"… (N more line(s) omitted)"` + `truncated: true`)
is a deliberate design choice over silent truncation: a downstream
consumer (reviewer, Final Review, or a human) always knows when it's
looking at a partial view versus a complete one, rather than mistaking
compaction for completeness.

## 8. How duplicate context is avoided

- **Explore runs once, centrally, per PR** — not once per reviewer. This
  is the primary anti-duplication mechanism: four independent reviewers
  each doing their own git-diff/git-grep pass would mean 4× the git
  process spawns and 4× the risk of the four reviewers seeing subtly
  different pictures of "what the codebase contains" (e.g. if the working
  tree changed between calls). One pass, one shared source of truth.
- **Type-level narrowing** (§5) means a reviewer's *own* input never
  contains fields it doesn't need — there's no "pass the whole package and
  trust the reviewer to ignore the irrelevant 80%" pattern, which would
  cost the same tokens/bytes as if the reviewer used all of it.
- **Denylisted paths are computed once**, in Explore, and applied
  uniformly to changed-file detection, caller search, and test search —
  not re-implemented (and potentially re-diverging) in four separate
  places.
- **A noted, not-yet-taken optimization:** Security's and Style's
  on-demand `readFile` calls are independent — if both needed the same
  file's content for the same PR, they'd each fetch it separately today.
  Since each reviewer runs as an isolated, independent call (deliberately
  — see the architecture doc's reasoning for reviewer independence), this
  is a small, acceptable duplication rather than a design flaw: a shared
  read-through cache keyed by `(repoPath, ref, path)` would be a
  straightforward addition if profiling ever showed it mattered, without
  changing any reviewer's contract.
- **Cross-reviewer finding deduplication** (Step 4's Deduplication stage,
  not yet built) is the equivalent guarantee on the *output* side — the
  same defect flagged by two reviewers must collapse into one presented
  finding, not appear twice in what a human ultimately reads.

## 9. How token/context usage is controlled

Concretely, today:

- **The reviewers consume zero model tokens.** They're deterministic
  TypeScript functions (Step 6's design choice, made explicitly for
  testability — see [review-subagents.md](review-subagents.md#implementation)).
  There is no context-window concern for Logic/Test-coverage/Security/
  Style *at all* in the current implementation — their "context budget" is
  a function-call-argument size, not a token count.
- **Explore's own cost is git-process time and JSON size**, not model
  tokens either (Step 5's same design choice) — bounded by the caps in §6.
- **The caps that exist are explicit, named constants** (`maxHunkExcerptLines`,
  `maxCallers`), not implicit behavior — anyone extending this pipeline can
  see and tune exactly what governs context size.
- **Looking ahead, honestly:** once Plan or a reviewer becomes LLM-backed
  (§4's noted future direction), token cost becomes real, and the type
  contracts already established here are precisely what will keep it
  bounded — a future LLM-backed Security reviewer, for instance, would
  receive the *same* narrowed `SecurityReviewInput` an LLM call would be
  built from, not "the repo, please figure out what matters."

## 10. How the final reviewer receives findings without unnecessary source material

**Status: designed (Step 4), not yet implemented.** Per the architecture,
Final Review's entire input is: the deduplicated, filtered `Finding[]`
list, minimal PR metadata (title, changed-file *paths*, not content), and
the rubric's output-format section. Explicitly **not** included: the diff,
any file content, any reviewer's raw pre-normalization output, or repo
tool access of any kind (`subagent-architecture.md §7`).

This serves the context-budget goal directly, not just the (also
important) invention-prevention goal covered in Step 4: a `Finding` is a
fixed-size structured object — nine short fields — regardless of how large
the diff that produced it was. A 5-file PR and a 500-file PR that both
happen to produce, say, 6 findings give Final Review **the same size
input**. This is what lets Final Review's own cost stay flat as PR size
grows, in contrast to every earlier stage, whose cost scales (linearly, per
§6) with the diff. By the time information reaches Final Review, it has
already been compacted from "however large the change was" down to "a
handful of structured facts" — the steepest compaction ratio in the whole
pipeline, and the reason Final Review is the cheapest stage to run
regardless of how expensive reviewing the PR itself was.

## Example data flow

```
PR metadata                     { baseRef: "main", headRef: "assignment/seeded-defects" }
  (a few bytes — coordinates, not content)
      │
      ▼
Explore's diff summary           ExploreContextPackage
  (hunks only, symbol labels,       — for DEFECT-1's file: 2-line hunk excerpt (~70 bytes)
   caller/test paths, risk            vs. the ~3.4 KB source file it came from
   flags, templated purpose)
      │
      ▼
Plan's per-reviewer context      { files: [{ path, changeKind, hunks, changedSymbols }] }
  (narrowed Pick<> slice per        — Logic's slice for this file carries no relevantTests,
   reviewer — today: static           no callers, no riskFlags; ~4 fields instead of ~12
   narrowFor*Review(), see §4)
      │
      ▼
Specialized reviewer             detectComparisonOperatorFlip(file, hunk)
  (narrowed input + rubric +        — reasons only over the 2-line excerpt already in hand;
   ≤1 on-demand scoped read)          zero additional file reads needed for this detector
      │
      ▼
Structured findings              Finding { category: "logic-error", severity: "MUST-FIX",
  (Logic reviewer's own                    file: "…/opportunity-scoring.ts", line: "22", … }
   Finding[], this file only)       — one ~500-byte structured object
      │
      ▼
Normalized findings              (Step 4's design, not yet built)
  (stable ID assigned,               — same ~500 bytes + a small ID/provenance wrapper
   schema-validated, deduped
   against the other 3 reviewers'
   output for this same PR)
      │
      ▼
Final triage                     (Step 4's design, not yet built)
  (Final Review: closed-book,        — input size = O(number of findings), not O(diff size);
   findings-only synthesis)            for this PR: 3 findings in, one prioritized Markdown
                                        comment out — no diff, no file content, ever touched
```

## Why passing the complete repository to every subagent is undesirable

Concrete, not just "it's expensive":

1. **Cost multiplies for zero marginal benefit.** Most of a repository is
   irrelevant to any single PR's diff. LeadRadar alone is a ~1,200-package-
   dependency, multi-thousand-file monorepo (Step 1's audit); a PR
   touching 3 files has no legitimate need to see the other several
   thousand, and paying to include them (whether in tokens, bytes, or git
   I/O) buys nothing.
2. **It doesn't scale with the right variable.** "The whole repository" is
   a cost that grows with the *codebase's* size forever, independent of
   any given change. "The diff plus its directly-connected context"
   (callers, tests, siblings) grows with the *change* — which is the
   thing that actually needs review, and the only thing that stays
   bounded as the repository itself grows over years.
3. **Reasoning quality degrades with irrelevant volume**, not just speed —
   true for an LLM-based reviewer and just as true for a human handed a
   1,000-file "context dump" instead of a 3-file diff: the signal (what
   actually changed and why it might be wrong) gets harder to find as
   noise increases, which directly undermines the rubric's own evidence-
   gate philosophy (Step 2) of precise, quotable findings over vague ones.
4. **Larger attack surface for adversarial content.** In a real CI
   deployment, PR diffs are attacker-influenceable (any external
   contributor can open one). The architecture doc's
   [adversarial-diff resilience](subagent-architecture.md#adversarial-diff-resilience)
   section already treats diff content as untrusted data; every additional
   file included as "context" is additional untrusted surface a compromised
   or careless pipeline stage could be misled by, for no compensating
   benefit.
5. **It weakens, rather than strengthens, the ground-truth isolation
   guarantee.** The denylist mechanism (§3, §8) is only meaningful because
   scope is otherwise narrow and explicit — "read the whole repo" makes an
   exclusion list a game of whack-a-mole instead of the structural
   guarantee it's designed to be.
6. **It produces four inconsistent pictures of the codebase, not one.**
   If each reviewer independently pulled "the repo" fresh, four reviewers
   could each observe the codebase at a subtly different moment or via a
   different search strategy. Explore running once and being the single
   source of truth for what the codebase contains — with every downstream
   stage working from that one artifact — is what keeps the four
   reviewers' output mutually consistent.

## No application behavior was changed in this step

This step was documentation-only, as instructed — no source files under
`packages/review-bot/` (or anywhere else) were modified. The behavior
described above is exactly what Steps 5–6 already implement and test; this
document adds no new capability, only an explicit account of the strategy
already in place and the parts of it (Plan, Final Review) still pending
from the Step 4 architecture.
