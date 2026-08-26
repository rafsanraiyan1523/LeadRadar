# Explore Subagent — Implementation

Assignment: "From Review Criteria to a Bot Running in CI" — Step 5

This document covers the first real implementation in the review-bot
pipeline designed in
[docs/assignment/subagent-architecture.md](subagent-architecture.md): the
**Explore subagent**. Code lives at
[packages/review-bot/src/explore/](../../packages/review-bot/src/explore/),
a new workspace package following the same conventions as every other
package in this monorepo.

## Implementation

### Where it lives, and why

`packages/review-bot` is a new pnpm workspace package (picked up
automatically by `pnpm-workspace.yaml`'s `packages/*` glob), scaffolded
identically to `packages/providers`: same `tsconfig.json` extending
`packages/config/tsconfig.base.json`, same `@lead-radar/eslint-config` flat
config, same `build`/`typecheck`/`lint`/`test` script names, same
Vitest-with-zero-config test runner. This means every existing repo-wide
command (`pnpm -r run lint`, `pnpm -r run typecheck`, `pnpm -r run test`,
and the root `build`/`lint`/`typecheck`/`test` scripts) picks it up with no
changes anywhere else — verified below.

### A deliberate design choice: no LLM call

The architecture doc describes Explore as an agent with tool access. This
implementation provides Explore's **deterministic engine** — the actual
fact-gathering logic — without an LLM in the loop. That is a direct
application of the architecture's own
["agents only where judgment is required"](subagent-architecture.md#design-principle-agents-only-where-judgment-is-required)
principle: everything Explore's contract asks for (which files changed,
what symbols they touch, who calls them, which tests are relevant, what
looks risky) is objectively determinable from git and static text
analysis — none of it requires judgment. Building it this way means:

- **No network/model calls in the test suite** — all 22 tests run in ~12s,
  fully offline, deterministic, and CI-friendly.
- **Zero new runtime dependencies** — only Node built-ins
  (`node:child_process`, `node:fs`, `node:os`, `node:path`) and the repo's
  existing dev-dependency set (`typescript`, `vitest`,
  `@lead-radar/eslint-config`). No diff-parsing or git library was added;
  a small hand-rolled unified-diff parser was sufficient and keeps the
  dependency surface at zero (see `diff-parser.ts`).
- It stays swappable: a future LLM-driven Plan/reviewer subagent can call
  `runExplore()` as a tool, or a smarter LLM-based Explore could wrap this
  module's git plumbing — the contract (`ExploreInput` →
  `ExploreContextPackage`) doesn't change either way.

### Module layout

```
packages/review-bot/src/explore/
  types.ts       — the public contract (ExploreInput, ExploreContextPackage, ...)
  git.ts         — git CLI wrapper (execFileSync, argv arrays — no shell interpolation)
  diff-parser.ts — hand-rolled unified-diff → hunk parser
  symbols.ts     — regex-based top-level exported-symbol extraction + line-range ownership
  callers.ts     — finds referencing files via `git grep` against the head ref's tree
  tests.ts       — finds relevant test files (co-located spec / e2e-suite / import reference)
  risk.ts        — mechanical, fact-only risk flagging (no severity, no verdicts)
  summarize.ts   — line-count truncation + templated (non-judgmental) purpose text
  explore.ts     — runExplore(): orchestrates the above into one ExploreContextPackage
  index.ts       — public exports
  test-support/temp-repo.ts — hermetic throwaway git repo fixture for tests
  *.spec.ts      — tests (see Tests below)
```

### How it satisfies each required responsibility

1. **Receives PR/change information.** `ExploreInput` takes a local git
   working tree path plus `baseRef`/`headRef` (e.g. `main` /
   `assignment/seeded-defects`) — the same coordinates a CI job checking out
   a PR head would have. A future GitHub-API-backed caller (Step 6+) just
   needs to resolve a PR to `{repoPath, baseRef, headRef}` before calling in;
   this module doesn't need to know anything about GitHub itself.
2. **Identifies changed files.** `getChangedFileStatuses()` runs
   `git diff --name-status --find-renames` against the **merge-base** of
   `baseRef`/`headRef` (not `baseRef`'s current tip) — this is the same
   three-dot-equivalent distinction verified in
   [benchmark-ground-truth.md](benchmark-ground-truth.md) and required by
   [the architecture doc's ground-truth isolation section](subagent-architecture.md#ground-truth-isolation).
   Covered by the `"diffs against the merge-base, not baseRef's current
   tip"` test.
3. **Inspects enough surrounding code to understand the changes** without
   reading whole files into the output: `parseUnifiedDiff()` extracts only
   the `+`/`-` lines per hunk (context lines are dropped even before
   truncation); `extractTopLevelSymbols()` + `symbolsForLineRange()`
   determine which exported declaration(s) a hunk's line range falls under,
   so a hunk is labeled ("touches function `addNumbers`") without needing
   to show the function's full body.
4. **Identifies dependencies/callers/tests/configuration.**
   `findCallers()` and `findRelevantTests()` both use `git grep` directly
   against the head ref's tree (no working-tree checkout, no per-file
   content pulled into Node just to search it) to find, respectively, other
   files referencing a changed symbol by name, and test files related to
   the changed file (co-located `*.spec.ts`, or any test-like file
   elsewhere that references it — labeled `e2e-suite-reference` when that
   test lives under an `e2e/`/`test/` directory, matching this repo's own
   convention from `apps/api/test/*.e2e-spec.ts` /
   `apps/web/e2e/*.spec.ts`).
5. **Produces a concise structured summary** — `ExploreContextPackage`, a
   plain, fully JSON-serializable object (see Output format below).
6. **Avoids returning raw full-file contents** — see
   [Context reduction strategy](#context-reduction-strategy).
7. **Avoids making review findings itself** — every type in `types.ts` is
   fact-only by construction: there is no `severity` field anywhere in the
   schema for a judgment to be written into. `risk.ts`'s flags name a
   *pattern* ("path matches a security-sensitive naming convention", "no
   relevant test file found") — never a verdict ("this is a
   vulnerability", "this is broken"). Verified directly by a test that
   scans the entire serialized output for the rubric's severity vocabulary
   (`MUST-FIX`/`SHOULD-FIX`) and asserts it never appears.

## Input/output format

### Input — `ExploreInput`

```ts
interface ExploreInput {
  repoPath: string;        // path to a local git working tree
  baseRef: string;         // PR target branch, e.g. "main"
  headRef?: string;        // PR source branch/SHA; defaults to "HEAD"
  maxHunkExcerptLines?: number; // truncation cap per hunk; default 12
  maxCallers?: number;          // cap on recorded callers per file; default 8
  denylistPaths?: string[];     // extra paths to exclude, on top of the built-in defaults
}
```

### Output — `ExploreContextPackage`

```ts
interface ExploreContextPackage {
  baseRef: string;
  headRef: string;
  mergeBase: string;
  generatedAt: string;           // ISO timestamp
  changedFiles: ChangedFileSummary[];
  globalMissingContext: string[]; // repo-wide caveats (see Limitations)
  summary: string;                // one templated sentence, e.g.
                                   // "3 file(s) changed (+17/-3 lines) between a737641
                                   //  (merge-base of main) and assignment/seeded-defects."
}

interface ChangedFileSummary {
  path: string;
  changeKind: "added" | "modified" | "deleted" | "renamed";
  renamedFrom?: string;
  linesAdded: number;
  linesRemoved: number;
  purpose: string;                          // templated, mechanical — see below
  changedSymbols: { name: string; kind: "function"|"class"|"interface"|"const"|"method"|"unknown"; line: number }[];
  hunks: { header: string; startLine: number; endLine: number; excerpt: string; truncated: boolean }[];
  callers: string[];                        // repo-relative paths, capped
  relevantTests: { path: string; changedInDiff: boolean; matchedBy: "co-located-spec"|"e2e-suite-reference"|"import-reference" }[];
  potentiallyAffectedBehavior: string[];    // plain-language, fact-based impact notes
  riskFlags: { kind: string; description: string }[]; // no severity field — see above
  missingContext: string[];
}
```

Example `purpose` strings (all mechanically templated from the diff shape,
never generated by inferring intent):

- `"Touches function addNumbers across 1 hunk(s) (+1/-0 lines)."`
- `"New file adding function foo, const BAR."`
- `"Renamed from src/old.ts, with content changes."`
- `"File removed."`

This directly answers Step 4's per-subagent contract for Explore ("what
information is it allowed to receive / must not receive / how is output
consumed") in concrete, typed form — see
[subagent-architecture.md §1](subagent-architecture.md#1-explore-subagent).

## Context reduction strategy

Three independent mechanisms, each covered by a test:

1. **Hunks only, never whole files.** `parseUnifiedDiff()` keeps only `+`/
   `-` lines from `git diff` output — context lines are dropped at parse
   time, before any truncation logic even runs. A changed line deep inside
   a 1,000-line file never pulls its neighboring *unchanged* lines into the
   output at all.
2. **Per-hunk excerpt truncation.** `truncateLines()` caps every hunk
   excerpt at `maxHunkExcerptLines` (default 12), appending a `"… (N more
   line(s) omitted)"` marker and setting `truncated: true` rather than
   silently dropping content. A 30-line inserted block, capped at 10 lines
   in the test, is verifiably cut — the excerpt contains the first added
   line but not the last, and is at most 11 lines long (10 kept + 1 notice).
3. **Symbol-name summaries instead of source dumps.** `changedSymbols`
   records a `{name, kind, line}` triple — never the declaration's body —
   so a reviewer downstream learns *what* was touched without the context
   package carrying the implementation itself.

Together, these mean the context package for even a very large file is
bounded by the size of its *changes*, not the size of the file — verified
directly: [`explore.spec.ts`](../../packages/review-bot/src/explore/explore.spec.ts)'s
large-file test builds a 300-line fixture file, changes 30 lines of it, and
asserts the fully serialized `ExploreContextPackage` (a) never contains a
filler line from far away in the untouched file and (b) is shorter than the
original file's raw text — i.e., genuinely smaller, not just "doesn't
happen to include one specific string."

A fourth mechanism enforces the **ground-truth isolation** principle from
the architecture doc: a hardcoded denylist
(`docs/assignment/benchmark-ground-truth.md`, `node_modules`, `dist`,
`.next`, `packages/db/generated`) is checked before a path is ever treated
as a changed file, a caller, or a test match — defense-in-depth on top of
the structural guarantee that this file simply isn't present in a seeded
PR branch's history (see
[benchmark-ground-truth.md](benchmark-ground-truth.md)). Tested directly:
a fixture where the ground-truth path is deliberately made to look like a
plausible caller (it textually contains the changed symbol's name) still
never appears in `callers`, `changedFiles`, or anywhere in the serialized
output.

## Tests

All tests live alongside their modules
(`packages/review-bot/src/explore/*.spec.ts`) and run via `pnpm --filter
@lead-radar/review-bot run test` (Vitest, matching every other package in
the repo). Integration-level tests (`explore.spec.ts`) exercise
`runExplore()` against a real, hermetic, throwaway git repository created
fresh per test via `test-support/temp-repo.ts` — real `git` CLI calls, no
mocking of git itself, and no dependency on this repository's own current
file layout (so the tests won't break as LeadRadar's own source evolves).

| Requirement | Test(s) |
|---|---|
| Changed files correctly identified | `"correctly identifies added, modified, and deleted files, and ignores untouched ones"`; `"diffs against the merge-base, not baseRef's current tip"` |
| Output is structured | `"returns a well-formed, JSON-serializable structure with every required field present"` (asserts a JSON round-trip is lossless and every required field is present); `"never emits a severity/verdict"` |
| Large source files are summarized, not dumped | `"truncates an oversized hunk and never includes the untouched surrounding file content"` |
| Relevant context is retained | `"finds a caller (via reference) and a co-located test for a changed function"`; `"flags an important change with no relevant test found at all"` |
| (extra) Ground-truth isolation | `"never surfaces a denylisted path as a caller, test, or changed file"` |
| (extra) Pure-function unit coverage | `diff-parser.spec.ts` (3 tests), `symbols.spec.ts` (5 tests), `risk.spec.ts` (6 tests) |

### Actual results (run on `main`, 2026-08-25)

```
$ pnpm --filter @lead-radar/review-bot run typecheck   → clean, 0 errors
$ pnpm --filter @lead-radar/review-bot run lint         → clean, 0 issues
$ pnpm --filter @lead-radar/review-bot run test

 Test Files  4 passed (4)
      Tests  22 passed (22)
   Duration  ~12s
```

Full-repo regression check (nothing else in the monorepo broke by adding
this package):

```
$ pnpm run build:packages                → clean
$ pnpm -r run lint                       → clean, all 5 lintable workspaces (incl. review-bot)
$ pnpm -r run typecheck                  → clean, all 6 typechecked workspaces (incl. review-bot)
$ pnpm -r run test                       → 285/285 passing total:
                                             packages/providers   209/209
                                             packages/review-bot   22/22   (new)
                                             apps/worker            18/18
                                             apps/api                36/36
$ pnpm --filter @lead-radar/review-bot run build   → clean (tsc emits to dist/)
```

No test result is fabricated or rounded — these are the literal totals
from the actual runs above.

## Limitations

Stated directly in the output itself (`globalMissingContext`) as well as
here, so a downstream reviewer subagent — or a human — knows exactly where
Explore's facts stop being reliable:

- **Symbol extraction is regex-based, not a real parser.** Only top-level
  `export function/class/interface/const` declarations are indexed.
  Nested functions, non-exported helpers, re-exports (`export { x } from
  ...`), and default exports are invisible to it. A future iteration could
  swap in the TypeScript compiler API for exact AST-based extraction
  without changing the `ExploreContextPackage` contract.
- **Caller/test discovery is name-based text search (`git grep -F`), not a
  real import graph.** It can miss indirect usage (re-exports, dynamic
  `require`/`import()`, string-built module paths) and can — rarely —
  false-positive on an unrelated identifier that happens to share a name.
  Names under 3 characters are skipped specifically because they produce
  too much of this noise to be useful.
- **Hardcoded-secret detection is shape-based pattern matching** (a Google
  API key shape, an OpenAI/Anthropic-style key shape, a long base64-ish
  quoted literal) — a hint for a reviewer, not a real entropy/credential
  scanner, and both false positives (a long non-secret constant) and false
  negatives (a secret in an unrecognized shape) are expected. This is
  intentional: Explore's job is to point reviewers at the same handful of
  places a human would double-check first, not to replace the
  Security-review subagent's judgment (see the architecture doc).
- **No cross-file/cross-package semantic understanding.** Explore doesn't
  know that `packages/providers`' `computeOpportunityScore` is imported
  transitively through `apps/api`'s digital-intelligence module unless a
  direct name match happens to surface it via `git grep` — deep,
  multi-hop call chains aren't traced.
- **Local git working tree only.** `ExploreInput.repoPath` must be an
  actual checkout; there is no GitHub API integration yet (deliberately —
  out of scope until a later step), so this module can't yet be pointed at
  a PR number directly.
- **`readFileAtRef` reads a changed file's full head-ref content into
  memory to run symbol extraction against it** — this is an internal
  processing step, not part of the returned output (verified by the
  large-file test, which confirms the *output* never contains the file's
  untouched content) — but it does mean a single pathologically large
  file could be slow to process. No size cap is currently applied to this
  internal read; if this becomes a real problem in practice, a size cutoff
  with a `missingContext` note would be the natural fix.

## What's next (not part of this step)

Per the architecture doc, `ExploreContextPackage` is exactly what the
**Plan subagent** consumes next, to build the four specialized reviewers'
targeted briefs. Plan and the specialized reviewers are not implemented
yet — this step stops at Explore, as instructed.
