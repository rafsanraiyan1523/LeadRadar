# Step 1 — Repository Preparation

Assignment: "From Review Criteria to a Bot Running in CI"
Audit date: 2026-08-25
Repository: https://github.com/rafsanraiyan1523/LeadRadar (branch `main`, 5 commits, single branch — no other local/remote branches)

## Repository overview

LeadRadar is a lead-intelligence / prospecting SaaS tool: it discovers local
businesses, audits their digital presence (website, SEO, mobile, Google
Business profile), scores the opportunity, and helps draft outreach. It
includes a CRM pipeline, campaigns, and an analytics dashboard, and runs
fully in a mock mode requiring no external API keys.

It is a **pnpm monorepo** with 3 deployable apps and 6 shared packages:

- `apps/api` — NestJS + Prisma REST API (auth, CRM, campaigns, analytics, AI, lead-discovery, digital-intelligence, audit-log, queue, etc.)
- `apps/web` — Next.js 16 (App Router) + React 19 + Tailwind + shadcn/ui + TanStack Query + Zustand frontend
- `apps/worker` — BullMQ/Redis background job processor (lead discovery, enrichment, follow-up reminders)
- `packages/providers` — AI, website-crawler, audit-scoring, and lead-discovery provider logic shared by api/worker (heaviest-tested package)
- `packages/types`, `packages/db` (generated Prisma client), `packages/ui`, `packages/config`, `packages/eslint-config` — shared, mostly script-less support packages

## Tech stack

- **Language:** TypeScript throughout
- **Frontend:** Next.js 16.3.1 (App Router, Turbopack), React 19, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend:** NestJS 11, Prisma 5 (ORM), PostgreSQL
- **Jobs/Queue:** Redis, BullMQ
- **Monorepo tooling:** pnpm workspaces (`pnpm@11.22.0`, Node `>=22.13.0`)
- **Test frameworks:** Jest (api unit + e2e), Vitest (worker, providers), Playwright (web e2e, not wired into CI)
- **Infra:** Docker (docker-compose), GitHub Actions

## Package manager

pnpm `11.22.0` (pinned via `packageManager` field). Installed locally: pnpm 11.22.0, Node 24.18.0 — both satisfy the repo's declared minimums.

## GitHub repository / remote / branches

- Remote: `origin` → `https://github.com/rafsanraiyan1523/LeadRadar.git`
- Branches: only `main` (no feature branches, no PRs currently open)
- History: 5 commits total, all pushed directly to `main` (no PR-based workflow has been used yet on this repo)

## Existing GitHub Actions workflows

`.github/workflows/ci.yml` — single `CI` workflow, triggers on push to `main` and on every pull request. One job (`ci`) runs, in order: install (`pnpm install --frozen-lockfile`) → build shared packages → lint (`pnpm -r run lint`) → typecheck (`pnpm -r run typecheck`) → test (`pnpm -r run test`) → build (`pnpm -r --filter ./apps/* run build`). The web app's Playwright e2e suite is deliberately excluded from CI (documented in a workflow comment as too heavy for the project's current size).

**All 5 CI runs to date have failed** (verified via `gh run list`), every time at the same `apps/web` typecheck step — see Baseline results below.

## Important source directories

- `apps/api/src/{auth,leads,lead-discovery,digital-intelligence,crm,campaigns,analytics,ai,organizations,audit-log,queue,common}` — domain modules
- `apps/api/test/*.e2e-spec.ts` — 10 e2e suites (separate Jest config, spins up an embedded Postgres)
- `apps/web/src/{app,components,hooks,lib,stores}` — Next.js app router pages/components/state
- `apps/worker/src/{jobs,queues,config}` — BullMQ processors
- `packages/providers/src/{ai,audit,lead-discovery,website-crawler,lib}` — most heavily unit-tested code in the repo

## Test command

Root: `pnpm run test` (= `pnpm run build:packages && pnpm -r run test`), matching what CI runs.

Per-workspace:
- `apps/api`: `jest` (unit specs only — `rootDir: src`, `testRegex: .spec.ts$`). E2E is a **separate** script, `pnpm --filter api run test:e2e`, using `test/jest-e2e.json` (spins up an embedded Postgres via global setup/teardown).
- `apps/worker`: `vitest run`
- `packages/providers`: `vitest run`
- `apps/web`: **no unit/`test` script exists** — only `test:e2e` (Playwright), which is not run in CI.

⚠️ Note: the CI workflow's own comment claims the `Test` step covers apps/api's e2e suite ("apps/api's e2e suite ... so it runs here too"). That is inaccurate — the root `test` script only invokes each workspace's `test` script, and api's `test` script is unit-only. The e2e suite is never run in CI at all today. This is a documentation/wiring inconsistency worth fixing but was left untouched per the no-behavior-change constraint for this step.

## Build command

Root: `pnpm run build` (= `build:packages` + `pnpm -r --filter ./apps/* run build`), matching CI's build step.

## Lint / type-check commands

- Lint: `pnpm run lint` (= `build:packages` + `pnpm -r run lint`, ESLint per workspace)
- Typecheck: `pnpm run typecheck` (= `build:packages` + `pnpm -r run typecheck`, `tsc --noEmit` per workspace)

## Baseline results (all commands run from a clean clone, exactly as CI invokes them)

| Step | Command | Result |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | ✅ PASS (7m46s, 1244 packages) |
| Build shared packages | `pnpm run build:packages` | ✅ PASS (Prisma client, `@lead-radar/types`, `@lead-radar/providers`) |
| Lint | `pnpm -r run lint` | ✅ PASS (exit 0, all 4 lintable workspaces clean) |
| Typecheck | `pnpm -r run typecheck` | ❌ **FAIL** — `apps/web typecheck: src/app/layout.tsx(22,50): error TS2304: Cannot find name 'LayoutProps'.` (exit 2). `packages/types`, `packages/ui`, `packages/providers` all pass individually. |
| Test | `pnpm -r run test` | ✅ PASS — `packages/providers`: 209/209 tests (24 files); `apps/worker`: 18/18 tests (4 files); `apps/api` (unit only): 36/36 tests (8 files). Total: **263/263 passing.** |
| Test (api e2e, run manually — not part of CI) | `pnpm --filter api run test:e2e` | ✅ PASS — 110/110 tests, 11 suites (embedded Postgres spun up locally; "Redis connection unavailable" lines in the log are expected fake-queue error-path assertions, not failures) |
| Build | `pnpm -r --filter "./apps/*" run build` | ✅ PASS — `apps/worker` (tsc), `apps/api` (nest build), `apps/web` (`next build`, 19 routes generated) all succeed |

### Root cause of the typecheck failure

`apps/web`'s `tsconfig.json` includes `.next/types/**/*.ts`, which is where Next.js 16 generates the global `LayoutProps`/`PageProps` helper types. That directory is only created by `next build`, `next dev`, or `next typegen`. The standalone `pnpm -r run typecheck` script runs bare `tsc --noEmit` without ever generating those types first, so it always fails on a clean checkout — `next build` succeeds anyway because it generates the types itself before running its own internal type check. **This is a pre-existing defect, confirmed identical on GitHub's own CI for all 5 historical runs** (`gh run list` shows 5/5 failures, all at this exact step) — it was not introduced during this audit. Per this step's constraints, it was left unmodified.

## Repository suitability

**Suitable, with one caveat.** This repository is a good target for the assignment:

- Real multi-service TypeScript monorepo with meaningful business logic (scoring, audits, CRM, campaigns).
- Substantial existing automated test coverage: 373 tests across unit (Jest/Vitest) and integration/e2e (Jest + embedded Postgres) suites, spanning `packages/providers` (24 files), `apps/api` (8 unit + 10 e2e files), and `apps/worker` (4 files).
- A working GitHub Actions CI workflow already exists as an integration point for a review bot.
- A real GitHub remote with Actions enabled, so a bot can be wired into pull_request events immediately.

Caveats to be aware of for later steps:

- **CI is currently broken** (typecheck step fails on every run, see above). A review-criteria bot that gates on "CI passing" would need this fixed first, or would need to target specific jobs/checks rather than overall CI status. Recommend fixing this as a preparation step before Step 2 (see below) — it is a 1–2 line change unrelated to application behavior.
- **`apps/web` has zero unit tests.** All frontend coverage is a single Playwright golden-path e2e spec, which isn't run in CI. If the assignment's review bot is meant to reason about "did this PR add/adjust tests," PRs touching `apps/web` currently have no meaningful test signal to check.
- **No pull-request history.** Since all commits were pushed straight to `main`, there's no existing PR to validate the bot against — the first real PR you open will be the first test case.

## Preparation changes made in this step

**None.** No files were modified, no defects were introduced, and no application behavior was changed. This step was audit-only, as instructed.

## Recommended preparation changes (not yet applied — for approval before Step 2)

1. **Fix the `apps/web` typecheck failure.** Smallest safe fix: add a `typegen` (or equivalent `next` type-generation) step before `tsc --noEmit` in `apps/web`'s `typecheck` script, e.g. `next typegen && tsc --noEmit` (exact flag depends on the installed Next 16 CLI). This makes CI green without touching any application code or behavior.
2. **Correct or remove the misleading CI comment** claiming the `Test` step runs api's e2e suite, since it currently does not.
3. **Optional, larger scope:** add a minimal unit-test script to `apps/web` (even a handful of component/util tests) if the assignment's review bot will be expected to comment on frontend test coverage — current e2e-only coverage there won't exercise the bot's "did tests change" logic meaningfully.

Awaiting explicit go-ahead before proceeding to Step 2.
