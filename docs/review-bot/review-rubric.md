# PR Review Rubric

Assignment: "From Review Criteria to a Bot Running in CI" — Step 2
Target repository: LeadRadar (pnpm monorepo — NestJS API, Next.js web, BullMQ worker, Prisma/PostgreSQL, Redis)

This document defines exactly what an automated PR-review bot checks in this
repository, how it decides severity, what evidence it must produce, and the
structured format every finding must be reported in. Step 3+ will implement
a bot against this rubric; this document alone is the contract that bot must
satisfy. Two reviewers (human or bot) applying this rubric to the same diff
should reach substantially the same set of findings — see
[Consistency check](#consistency-check-two-reviewer-convergence) at the end.

## Scope

The bot reviews **the diff of a single pull request**, defined as:

- Lines added or modified in the PR (the "changed code").
- Existing (unchanged) code **only** when a changed line directly causes it
  to misbehave (e.g., a changed caller now passes an unvalidated value into
  an existing, previously-safe function). In that case, cite the changed
  line as the cause and the existing code as where the failure manifests.

Everything else — pre-existing issues untouched by the diff, generated
files (`packages/db/generated/**`, `.next/**`, `dist/**`), lockfiles, and
anything the repo's own tooling already enforces (see below) — is out of
scope and **must not** be reported, no matter how real the issue is.

**Tooling already enforced, therefore out of scope for this bot:**
ESLint (`pnpm -r run lint`, flat config via `@lead-radar/eslint-config`) and
Prettier (`.prettierrc.json`, `pnpm run format:check`). If a concern would be
caught or auto-fixed by either, it is IGNORE by definition — the bot should
not re-derive lint rules.

## Severity levels

Every finding gets exactly one severity. These are the only three values.

### MUST-FIX

Problems that can cause:

- incorrect behavior
- data corruption/loss
- security vulnerabilities
- authentication/authorization failures
- serious production failures

**Decision rule:** a finding is MUST-FIX only if the reviewer can point to a
concrete, realistically reachable input, request, or execution path (already
present in the diff or trivially reachable from it) that triggers the bad
outcome. "Would break under a rare, valid input on the golden path" and
"weakens or removes an existing security/data-boundary control" both count
as MUST-FIX. Purely theoretical or contrived triggers do not.

### SHOULD-FIX

Problems that:

- reduce reliability
- create maintainability problems
- leave important behavior insufficiently tested
- create meaningful performance or code-quality risks

**Decision rule:** the defect or gap is real and would plausibly cost real
engineering time or degrade quality/reliability, but does not meet the
MUST-FIX bar — either because the trigger condition is edge-case/rare rather
than golden-path, or because the risk is about future maintainability/test
confidence rather than a present, demonstrable incorrect outcome.

### IGNORE

Things that:

- are purely subjective
- are harmless stylistic preferences
- are already handled by the project's formatter/linter
- cannot be supported by evidence from the code
- are speculative without a concrete risk

**Decision rule:** if a finding fails the evidence bar defined in
[Output format](#output-format) (no specific file/line, no traceable
trigger, no plausible impact), it is not a MUST-FIX or SHOULD-FIX with weak
confidence — it is not reportable at all. IGNORE is not a bucket you file
findings into; it is a filter applied before a finding is ever written.

**Tie-break rules (mandatory, to remove reviewer-to-reviewer variance):**

1. Uncertain between MUST-FIX and SHOULD-FIX, and the uncertainty is about
   whether an *untrusted actor* can reach a security- or data-boundary
   defect → resolve to **MUST-FIX**, set `confidence: medium`, and state the
   uncertainty explicitly in `explanation`.
2. Uncertain between MUST-FIX and SHOULD-FIX for any other reason (e.g.,
   how "golden path" the triggering input is) → resolve to **SHOULD-FIX**,
   set `confidence: medium`.
3. Uncertain between SHOULD-FIX and IGNORE (i.e., evidence is present but
   weak, or impact is marginal) → **do not report it**. Silence is the safe
   default; a missed marginal finding costs less than eroding trust in the
   bot with noise.

## Category 1 — Logic errors

**What to look for:** incorrect conditionals/operators, off-by-one errors,
incorrect null/undefined/empty handling, wrong Prisma `where`/`include`
clauses (including missing tenant/org scoping — see also Category 3),
incorrect state transitions, missing `await` / unhandled promise rejections,
incorrect error handling that swallows or misclassifies errors, mutation of
shared/module-level state, incorrect type coercion or unsafe casts (`as`)
that paper over a real mismatch, and logic that contradicts the PR's own
stated intent (description/tests) or an adjacent, already-correct pattern in
the same module.

**Evidence required:** the exact line(s); a concrete input or system state
that produces the wrong output, expressed explicitly (e.g., "if
`leadId` belongs to another org and `getLeadOrThrow` is called without the
org check on line N, it returns that org's data"); and, where relevant,
whether an existing test exercises this path and why it didn't catch the
issue (or confirmation that no test does).

**Severity criteria:**

- **MUST-FIX:** wrong output/behavior reachable on the golden path; silent
  data corruption or loss; a crash triggerable by common/expected input;
  logic that causes data to cross a tenant/user boundary.
- **SHOULD-FIX:** wrong behavior only under rare/edge inputs; correctness
  degradation that doesn't corrupt data; new logic duplicating existing
  logic in a way that risks future drift between the two copies.
- **IGNORE:** a hypothetical "what if X" with no plausible call site or
  input that produces X today.

**Examples:**

- `packages/providers/src/audit/opportunity-scoring.ts`-style function
  changed so a weight is divided instead of multiplied for one signal,
  changing every score silently → **MUST-FIX** (wrong output, golden path,
  no crash to alert anyone).
- A new pagination helper using `page * limit` instead of
  `(page - 1) * limit`, only wrong when `page === 1` returns an
  off-by-`limit` window → **SHOULD-FIX** if `page=1` is still reachable and
  wrong, but bumped to **MUST-FIX** if page 1 is the default/most common
  case (i.e., it's the golden path, not an edge case).
- A new `if (value === undefined)` guard added around a value the function's
  own type signature (and all call sites in the diff) guarantee is always
  defined → **IGNORE** (defensive code with no reachable trigger — unless it
  is *hiding* a real bug elsewhere, in which case report the real bug).

**False-positive avoidance:**

- Do not flag a code path without tracing it to an actual call site present
  in, or reachable from, the diff.
- Do not assume a framework/library (NestJS DI, Prisma, BullMQ) behaves
  incorrectly without checking its documented behavior for the installed
  major version first.
- Do not flag `unknown`/broad types as bugs if they are narrowed correctly
  before use later in the same function.

## Category 2 — Missing tests / untested code paths

**What to look for:** new or changed exported functions, controllers,
guards, processors, or React components with no corresponding test change
in the same PR; new branches (`if`/`else`, `catch`, `switch` cases) added to
already-tested code with no new test hitting that branch; changed business
logic (scoring, auth, org-scoping, queue enqueue/consume) where existing
tests were not updated to reflect the new behavior (so they may now be
asserting the *old*, wrong behavior); new error-handling paths with no test
proving they trigger correctly.

**Evidence required:** name the specific function/branch/endpoint that
changed; confirm, by checking the full diff (not just one file), that no
test file in the PR exercises it; state explicitly whether the gap is "no
test touches this at all" vs. "a test touches this area but not this new
branch/case." A missing test finding without this distinction is not
reportable.

**Severity criteria:**

- **MUST-FIX:** not used for "missing test" in isolation. If an untested
  path also contains a demonstrable logic or security defect, file that
  defect under Category 1 or 3 at MUST-FIX, and use `evidence` to note it
  was untested — do not double-file the same root cause as a separate
  Category 2 finding (see [duplicate findings](#do-not-report)).
- **SHOULD-FIX:** new or changed behavior in an important path — auth,
  org/tenant boundary enforcement, data mutation (create/update/delete),
  queue job enqueue/processing, external I/O (crawler, AI provider calls) —
  has no added or updated test.
- **IGNORE:** purely additive, low-risk code (a new UI label/copy string, a
  log line, a trivial getter/re-export) without tests; code already
  exercised indirectly by an existing e2e suite (verify this before
  flagging — see `apps/api/test/*.e2e-spec.ts`); test coverage of
  generated code (`packages/db/generated/**`).

**Examples:**

- A new NestJS guard added and applied to a controller, with no
  `*.guard.spec.ts` added or updated (compare to the existing pattern at
  `apps/api/src/common/guards/{jwt-auth,org,roles}.guard.spec.ts`) →
  **SHOULD-FIX**.
- A new `catch` branch added to an existing, well-tested service method to
  handle a new provider error type, with no test asserting the new
  behavior → **SHOULD-FIX**.
- A new pure formatting helper used only in a static marketing page, with no
  test → **IGNORE**.

**False-positive avoidance:**

- Always search the entire PR diff for test file changes before claiming
  "no tests were added" — the test may be in a different file than the
  implementation.
- Check whether an existing e2e spec already exercises the changed endpoint
  end-to-end (e.g., `apps/api/test/leads.e2e-spec.ts` may already cover a
  new branch in `leads.service.ts` even if no unit spec was added).
- Do not flag test *quality* here (e.g., "this test should also check X") —
  that is only reportable if the untested case is itself a plausible defect
  (file under Category 1/3), not as a standalone Category 2 finding.

## Category 3 — Security problems

**What to look for**, grounded in this codebase's actual controls:

- **AuthN/AuthZ:** new or modified endpoints missing `@UseGuards` (this repo
  uses `JwtAuthGuard`, `OrgGuard`, `RolesGuard` from
  `apps/api/src/common/guards/`); Prisma queries that fetch/mutate records
  by ID without also constraining `organizationId` (the established pattern
  is exemplified by `getLeadOrThrow` in `apps/api/src/leads/leads.service.ts`,
  which checks `lead.organizationId !== organizationId` before returning);
  privilege/ownership checks implemented only in `apps/web` (client-side)
  without an equivalent server-side check in `apps/api`.
- **Injection:** raw/interpolated SQL (`$queryRawUnsafe` or string-built
  queries) with request-derived input; unsanitized input passed to a shell
  command; unescaped user content rendered as HTML in `apps/web` (XSS).
- **SSRF:** `packages/providers/src/website-crawler` performs outbound
  fetches to externally-supplied URLs and already hardens this via
  `url-safety.ts` (`isBlockedHostname`, `isPrivateOrReservedAddress`,
  `createSafeLookup`) and `fetch-with-limits.ts`. A new or modified outbound
  fetch in this area (or any new outbound-fetch call elsewhere, e.g. a new
  AI/provider integration) that does not route through these existing
  safety checks is in scope.
- **Secrets:** hardcoded API keys/tokens/passwords/connection strings in the
  diff; secrets written to logs; a value that should stay server-only
  exposed to the client bundle (Next.js requires an explicit `NEXT_PUBLIC_`
  prefix to expose an env var — flag any new env var given that prefix that
  looks like a secret, or a secret value passed as a prop into a Client
  Component).
- **Input validation:** a new NestJS endpoint/DTO missing `class-validator`
  decorators (the established pattern: see `@IsIn` on
  `apps/api/src/ai/dto/generate-outreach.dto.ts`) on user-controlled fields;
  missing bounds on a user-controlled loop or concurrency value (compare to
  the existing `RateLimiter` in `packages/providers/src/lib/rate-limiter.ts`
  and `createConcurrencyLimit` in `.../lib/concurrency-limit.ts`).
- **Dependencies:** a new dependency added in the diff with a publicly known
  critical CVE for the exact version pinned — only report if you can cite
  the CVE ID and confirm the vulnerable code path is actually reachable
  from how this repo uses it; do not run or claim to have run a live
  vulnerability scan.

**Evidence required:** the exact code path; the specific missing or
bypassed control, named (e.g., "no `@UseGuards(JwtAuthGuard, OrgGuard)` on
this method, unlike every other method in this controller" or "this fetch
call does not go through `createSafeLookup`/`isBlockedHostname` before
connecting"); and a concrete attacker-controlled input or request that
exploits the gap.

**Severity criteria:**

- **MUST-FIX:** unauthenticated or unauthorized access to protected data or
  actions; cross-organization data exposure; an injection point reachable
  with attacker-controlled input; SSRF via a crawler/provider path that
  bypasses the existing safety utilities; secrets committed in the diff;
  removing, weakening, or bypassing an existing security control (dropping
  a guard, widening a CORS/allowlist, disabling TLS/cert verification,
  removing an org-scoping check).
- **SHOULD-FIX:** defense-in-depth gaps that don't grant access today (e.g.,
  a new low-sensitivity endpoint with no rate limit while sibling endpoints
  have one); validation that is looser than it should be but not currently
  exploitable with realistic input; a sensitive action (data delete, role
  change) not recorded via the existing audit-log module
  (`apps/api/src/audit-log`) when comparable actions elsewhere are.
- **IGNORE:** vulnerabilities requiring capabilities outside this system's
  realistic threat model (e.g., "an attacker with DB server root could...");
  generic warnings against a battle-tested library's internals with no
  repo-specific misuse shown.

**Examples:**

- A new endpoint in `apps/api/src/leads` with no `@UseGuards(...)` while
  every sibling method in the controller has one → **MUST-FIX**.
- A new call to fetch a lead's website in `packages/providers` that uses
  Node's `fetch`/`undici` directly instead of the existing safe-fetch path
  → **MUST-FIX** (SSRF).
- A new internal-only admin endpoint missing a per-IP rate limit while
  public endpoints in the same controller have one → **SHOULD-FIX**.
- Using `Math.random()` for a new non-security correlation ID (not a
  session token, not a password-reset token) → **IGNORE**; only flag
  `Math.random()` when the value is actually used as a security-sensitive
  secret/token.

**False-positive avoidance:**

- Check for a class-level `@UseGuards` on the controller before flagging an
  individual method as unguarded.
- Confirm a "bypass" of `url-safety.ts` is real by checking whether the new
  code imports and calls it indirectly (e.g., through an existing crawler
  helper) before flagging.
- Do not flag standard framework default error responses, standard NestJS
  exception filters, or well-known safe patterns as vulnerabilities without
  a concrete exploit path.

## Category 4 — Style / maintainability

Because ESLint + Prettier already enforce formatting, import order, unused
variables, and most naming/style rules in this repo, this category is
intentionally narrow. Only flag issues that a linter/formatter would not
catch and that carry a real, statable maintenance cost.

**What to look for:** significant logic duplication introduced by the PR
(copy-pasted business logic instead of reusing an existing exported
function, e.g. reimplementing scoring instead of importing from
`packages/providers/src/audit/opportunity-scoring.ts`); a name that actively
misleads about behavior (e.g., a function named `isValid` that also mutates
state or has side effects); a function introduced or grown by the diff to
the point of materially hurting readability (deep nesting, very long
function, many responsibilities) *relative to the surrounding code's own
established style*; dead code introduced by the PR (unused exports,
unreachable branches, leftover debug code); magic numbers/strings
introduced by the diff that encode a business rule (e.g., a new scoring
threshold or weight) with no name/constant/comment explaining it;
inconsistent error-handling introduced within the same PR (some new paths
throw, others silently return `null`/swallow, for what should be equivalent
failure modes).

**Evidence required:** quote the specific pattern from the diff, and where
possible cite the existing convention elsewhere in the same file/module
that the new code deviates from (e.g., "every other threshold in this file
is a named `const`; this one is an inline literal").

**Severity criteria:**

- **SHOULD-FIX:** duplicated business logic that will plausibly drift out
  of sync with the original; a name that meaningfully misleads a future
  reader/caller about behavior or side effects; an unexplained magic
  constant encoding a business rule; complexity introduced by the diff that
  would make correctness review of *this same diff* meaningfully harder;
  dead code left in by the PR.
- **IGNORE:** anything ESLint/Prettier already catches or auto-fixes
  (formatting, import order, unused-var already flagged by lint, quote
  style, line length); naming preferences with no real ambiguity;
  subjective architectural opinions ("I would have used a class here")
  without a stated concrete maintenance cost; missing comments on code that
  is already self-explanatory from its names and types.

**Examples:**

- Opportunity-scoring math re-implemented inline in a controller instead of
  importing the existing `opportunity-scoring.ts` logic → **SHOULD-FIX**
  (drift risk — the two copies will diverge the next time either is
  tweaked).
- A new 150-line function added to a BullMQ processor with 6 levels of
  nested conditionals, where sibling processors in the same directory are
  all under 40 lines and flat → **SHOULD-FIX**.
- Renaming a local variable for clarity, or choosing `interface` over
  `type` → **IGNORE**.

**False-positive avoidance:**

- Before flagging duplication, confirm the "existing" implementation is
  actually importable from the new call site (not blocked by a circular or
  layering dependency — e.g., `apps/web` cannot import from `apps/api`).
- Before flagging complexity, check whether it's proportional to genuinely
  irreducible business complexity already mirrored elsewhere in the
  codebase, rather than complexity the PR introduced gratuitously.
- Run (or check the PR's CI result for) `pnpm -r run lint` before flagging
  anything style-adjacent — if lint is clean, the issue must clear a higher
  bar than "I would have written it differently" to be reportable.

## Output format

Every finding is a single structured object. This is both the
human-readable rendering and the schema a CI bot must emit (e.g., as JSON,
one object per finding, so Step 3+ can post/aggregate them programmatically).

```json
{
  "category": "logic-error | missing-tests | security | style-maintainability",
  "severity": "MUST-FIX | SHOULD-FIX | IGNORE",
  "title": "One-line summary of the defect, stated as a claim, not a question",
  "file": "apps/api/src/leads/leads.service.ts",
  "line": "22-24",
  "explanation": "What is wrong and why it matters — the mechanism, not just the symptom.",
  "evidence": "The specific code quoted or paraphrased, plus the concrete input/state/trigger that produces the bad outcome. Must be traceable back to the diff.",
  "suggested_fix": "A concrete, minimal change that would resolve it — a code sketch or precise instruction, not 'consider refactoring.'",
  "confidence": "high | medium | low"
}
```

Field rules:

- **category:** exactly one of the four category slugs above.
- **severity:** exactly one of `MUST-FIX`, `SHOULD-FIX`, `IGNORE`. In
  practice an `IGNORE`-severity item is filtered out before reporting (see
  the IGNORE decision rule above) — `IGNORE` appears in this enum for
  completeness and for any tooling that wants to log filtered candidates,
  not as a value that reaches the final report.
- **title:** ≤ 120 characters, states the defect itself (e.g., "Missing org
  check lets any authenticated user fetch another org's lead").
- **file / line:** exact path relative to repo root, and either a single
  line or an inclusive range covering the smallest span that demonstrates
  the issue.
- **explanation:** must state the *mechanism* (why it's wrong), not merely
  restate the title.
- **evidence:** must be falsifiable — another reviewer should be able to
  read this field and either confirm or refute the finding without needing
  to re-derive it themselves. A finding whose `evidence` is a restatement of
  `explanation` with no concrete trigger fails the evidence bar and must not
  be reported.
- **suggested_fix:** concrete and minimal, scoped to what the diff itself
  should change — not a request for an unrelated refactor.
- **confidence:**
  - `high` — the trigger is directly demonstrable by reading the diff alone
    (no assumptions about external state/config needed).
  - `medium` — the trigger is plausible and reasoned through, but depends on
    an assumption about runtime configuration, data state, or an adjacent
    file not fully inspected.
  - `low` — reserved for findings surfaced only for the tie-break rules
    above; a `low`-confidence finding should be rare and its `explanation`
    must say what would raise or resolve the uncertainty.

### Worked example

```json
{
  "category": "security",
  "severity": "MUST-FIX",
  "title": "New /leads/:id/export endpoint has no auth/org guard",
  "file": "apps/api/src/leads/leads.controller.ts",
  "line": "88-95",
  "explanation": "This method has no @UseGuards, and the controller class itself is not guarded either (checked: no class-level @UseGuards decorator). Every other method in this controller uses @UseGuards(JwtAuthGuard, OrgGuard). Any unauthenticated caller can hit this route and, because the service method it calls (LeadsService.exportLead) takes leadId directly without an organizationId parameter, retrieve any lead in the system regardless of org.",
  "evidence": "leads.controller.ts:88 `async exportLead(@Param('id') id: string)` has no guard decorator, vs. leads.controller.ts:40 `@UseGuards(JwtAuthGuard, OrgGuard)` on getLead. LeadsService.exportLead (leads.service.ts:140) calls `this.prisma.lead.findUnique({ where: { id } })` with no organizationId filter, unlike getLeadOrThrow (leads.service.ts:120) which checks `lead.organizationId !== organizationId`.",
  "suggested_fix": "Add `@UseGuards(JwtAuthGuard, OrgGuard)` to exportLead, and change LeadsService.exportLead to accept organizationId and route the lookup through the existing getLeadOrThrow helper instead of a raw findUnique.",
  "confidence": "high"
}
```

## Do not report

The bot must never emit a finding that is:

- **A hypothetical problem without evidence.** If you cannot cite the
  specific lines and a concrete trigger, it is not a finding.
- **A duplicate.** If the same root cause produces the same defect at
  multiple locations, report it **once**, listing every affected location
  in `evidence`/`line` (a range or list), rather than one finding per
  occurrence. If two different categories would independently flag the same
  root cause (e.g., an untested path that is also a security hole), file it
  once under the higher-severity category (Security/Logic) and note the
  test gap in that finding's `evidence` rather than filing a second,
  separate Category 2 finding.
- **A harmless style preference**, including anything ESLint/Prettier
  already enforces or would auto-fix.
- **Outside the changed code**, unless the changed code directly causes the
  problem (see [Scope](#scope)). Pre-existing issues untouched by the diff
  are out of scope even if the reviewer happens to notice them while
  reading surrounding context — note them separately as an aside if truly
  valuable, but never as a rubric finding against this PR.

## Consistency check: two-reviewer convergence

This rubric is designed so two independent reviewers (human or bot)
evaluating the same PR diff converge on substantially the same findings.
The mechanisms that enforce this, and their limits, are:

1. **Bounded scope.** "Changed lines, plus what they directly cause" is a
   mechanically checkable boundary (readable straight off `git diff`), not
   a judgment call about what's "relevant" — both reviewers search the same
   space.
2. **Mandatory evidence field.** A finding isn't valid until it names exact
   lines and a concrete trigger. This eliminates the largest source of
   reviewer-to-reviewer variance: vague, gut-feeling findings that can't be
   checked against the code.
3. **Category-specific decision rules, not just descriptions.** Each
   category states a rule ("golden path + demonstrable ⇒ MUST-FIX";
   "important path + no test ⇒ SHOULD-FIX"; "no reachable trigger ⇒ not
   reportable"), so severity is derived from a checkable property of the
   evidence rather than the reviewer's personal risk appetite.
4. **Style/formatting is removed from subjective judgment.** Deferring
   everything ESLint/Prettier already enforces to those tools (rather than
   to reviewer taste) removes the category historically responsible for the
   most reviewer disagreement.
5. **Explicit tie-break rules** convert the remaining genuine ambiguity
   (adjacent-severity judgment calls) into a deterministic default, so two
   reviewers who are both uncertain land on the same answer instead of
   diverging based on personal risk tolerance.
6. **Grounded, repo-specific examples** (real guard names, real safety
   utilities, real DTO patterns) give both reviewers the same reference
   point for "what does the established/correct pattern look like here,"
   rather than each reviewer inventing their own baseline.

**Residual, acknowledged source of disagreement:** two reviewers can still
disagree on whether a given input is truly "golden path" vs. "edge case"
for a specific piece of business logic they're unfamiliar with (e.g., is
`page=0` actually reachable from the web client today?). This rubric
narrows that judgment call as far as is reasonable without becoming
unusable, and the tie-break rules ensure that even in disagreement, both
reviewers default to the same resolved severity rather than silently
diverging.

## Reviewer pre-submit checklist

Before finalizing any finding, confirm all of the following — if any answer
is "no," do not report it:

- [ ] I can name the exact file and line(s), and they are in the diff (or
      directly caused by it).
- [ ] I can state a concrete input/request/state that triggers the problem.
- [ ] This is not something ESLint or Prettier would already catch.
- [ ] This is not a duplicate of a finding I've already written for this PR.
- [ ] I have checked for an existing guard/validation/safety-utility/test
      that might already cover this before concluding it's missing.
- [ ] The severity I chose matches the decision rule for its category, not
      just my gut feeling.
