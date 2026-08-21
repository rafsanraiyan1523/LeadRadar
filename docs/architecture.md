# Architecture

## Overview

LeadRadar is a pnpm-workspace monorepo with three deployable apps and a set of shared packages.

```
                 ┌─────────────┐
                 │   web (Next) │  :3000
                 │  App Router   │
                 └──────┬───────┘
                        │ REST (cookies, credentials: include)
                        ▼
                 ┌─────────────┐        ┌───────────┐
                 │  api (Nest)   │◄──────►│ PostgreSQL │
                 │  REST API     │        └───────────┘
                 └──────┬───────┘
                        │ enqueue jobs (BullMQ)
                        ▼
                 ┌─────────────┐        ┌───────────┐
                 │   worker      │◄──────►│   Redis    │
                 │  BullMQ jobs  │        └───────────┘
                 └─────────────┘
```

- **web** never talks to Postgres/Redis directly — it only calls the **api** over REST.
- **api** owns the database (via Prisma) and enqueues background work onto Redis-backed BullMQ
  queues; it does not process long-running jobs itself.
- **worker** consumes those queues (lead discovery, enrichment, website audits, AI generation)
  out-of-process so the API stays responsive.

## Why this split

Lead discovery and enrichment involve calling external services (Google Places, target
websites) that are slow and rate-limited. Doing that work inline in an HTTP request would tie
up API workers and produce a poor UX for anything but trivial searches. Pushing it onto BullMQ
jobs, processed by a separately-scaled `worker` service, keeps the API responsive and makes the
slow work independently scalable and retryable.

## Monorepo packages

| Package                     | Purpose                                                                                                                                                                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@lead-radar/types`         | Shared TypeScript types/contracts used by more than one app (e.g. the health-check shape). Domain models will land here as each module is built.                                                                                                            |
| `@lead-radar/ui`            | Cross-app React primitives with no framework-specific dependencies — currently the brand mark/logo. shadcn/ui components themselves live inside `apps/web` (shadcn is a code-generator, not a runtime dependency, so its output belongs with its consumer). |
| `@lead-radar/config`        | Shared `tsconfig.base.json` extended by every package/app.                                                                                                                                                                                                  |
| `@lead-radar/eslint-config` | Shared flat ESLint config for plain-TypeScript packages (`worker`, `types`, `ui`). `web` and `api` keep their framework-generated configs (`eslint-config-next`, Nest's default) since those encode framework-specific rules.                               |

## Provider abstractions

The product's core value (lead discovery, enrichment, AI-generated insight/outreach) depends on
external services that are either paid, rate-limited, or both. Every such dependency is defined
as an interface with a mock/local default implementation, so the app is fully functional with
zero external accounts or spend. This is a hard requirement, not a nice-to-have — see the task
brief's zero-cost requirement.

```ts
interface LeadDiscoveryProvider {
  searchBusinesses(query: SearchQuery): Promise<BusinessSummary[]>;
  getBusinessDetails(id: string): Promise<BusinessDetails>;
}
```

- `MockLeadDiscoveryProvider` — deterministic fixture data, default in development/demo.
- `GooglePlacesProvider` — wraps the official Google Maps Platform Places API. Server-side only;
  the API key is never sent to the browser. Requests a minimal field mask. Displays required
  Google attribution wherever Places data is shown. **Not** built by scraping Google Maps —
  scraping, browser automation against Maps, and bypassing anti-bot/CAPTCHA/login systems are
  explicitly out of scope.

The same pattern applies to AI generation (`MockAIProvider`, `LocalAIProvider`, optional
external `AIProvider`). Provider selection is environment-driven, so demo/dev defaults to
mock/local and paid providers are opt-in via API keys.

_(These interfaces are the design contract for the next phase — `lead-discovery` and `ai`
modules — and are not implemented yet in this foundation phase.)_

## Backend structure (NestJS)

- `ConfigModule` (`@nestjs/config`) loads and types environment variables (`src/config`).
- `PrismaModule` is `@Global()` and wraps `PrismaClient` in a `PrismaService` with proper
  `onModuleInit`/`onModuleDestroy` lifecycle hooks.
- `RedisModule` is `@Global()` and provides a single `ioredis` client under the `REDIS_CLIENT`
  token, shared by anything that needs direct Redis access (health checks now; BullMQ queue
  producers later).
- `HealthModule` exposes `GET /health`, checking both Postgres (`SELECT 1` via Prisma) and Redis
  (`PING`), returning the shared `HealthCheckResult` shape from `@lead-radar/types`.
- Global middleware: `helmet()`, `cookie-parser`, CORS restricted to `WEB_ORIGIN` with
  `credentials: true`, and a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`) so every future DTO is validated by default.

## Frontend structure (Next.js)

- App Router, React Server Components by default.
- Tailwind CSS v4 (CSS-first config via `@theme` in `globals.css` — no `tailwind.config.js`).
- shadcn/ui initialized with the `radix` base and a neutral base color; `components.json` and
  generated primitives live under `apps/web/src/components/ui`.
- Design tokens: mostly neutral (grayscale) surface/border/muted colors, with a single restrained
  brand accent (`--primary` / `--ring`, a cobalt blue) used for primary actions, focus rings, and
  active navigation states — not sprinkled throughout the UI.
- The homepage renders a live **system status card** that fetches the API's `/health` endpoint
  server-side, which is a genuine end-to-end check (web → api → Postgres/Redis) rather than a
  placeholder — this is how "frontend/backend/DB/Redis all connect" is verified in the running
  app, not just in scripts.

## Background jobs (worker)

The worker is intentionally minimal at this phase: it exposes `GET /health` (checking Redis) and
a `createQueue`/`createWorker` helper (`src/queues/registry.ts`) wired to a shared BullMQ
connection with sane defaults (3 retries, exponential backoff, bounded job retention). No queues
are registered yet — that happens alongside the `lead-discovery`, `website-audit`, and `ai`
modules in the next phase.

## Environment configuration

Each app has its own `.env.example`; the repo root has one too (consumed by
`docker/docker-compose.yml` for Postgres/Redis credentials). Copy each to `.env` (or
`.env.local` for `web`) to get started — defaults are safe for local development. See the
README's "Configure environment" step.

## Docker

- `docker/api.Dockerfile`, `docker/worker.Dockerfile`: multi-stage builds — install the full
  workspace, build the target app, then `pnpm deploy --prod` to produce a pruned,
  production-only copy of that app (source + prod `node_modules`), copied into a slim runtime
  image.
- `docker/web.Dockerfile`: builds with `next build` (Next's `output: "standalone"` traces the
  minimal server bundle) and copies the standalone output into the runtime image.
- `docker/docker-compose.yml`: `postgres` and `redis` always run; `api`, `worker`, and `web` are
  gated behind the `full` Compose profile so local development can run infra-only in Docker
  while the apps run natively with hot reload (`pnpm docker:up` vs `pnpm docker:up:full`).

## The Digital Intelligence Engine

Phase 3 (see [docs/roadmap.md](roadmap.md)) added the product's core differentiator: turning a
crawled website plus Google Business signals into explainable scores and growth-opportunity
findings, answering "why is this business a potential client?" Same split as everywhere else in
this codebase — pure, unit-tested scoring functions in `@lead-radar/providers/audit` (SEO,
mobile, conversion, technical, website, Google profile, opportunity, growth opportunities), the
worker's `lead-enrichment.processor.ts` orchestrates the actual crawl + Google Places lookup and
persists the results, and `apps/api/src/digital-intelligence` exposes six read-side services
(`WebsiteAuditService`, `SEOAuditService`, `ConversionAuditService`, `GoogleBusinessAuditService`,
`OpportunityScoringService`, `GrowthOpportunityService`) behind one aggregated `GET
/leads/:id/audit` endpoint for the `/app/leads/[id]` page. The full scoring formula, with worked
examples, is documented in [docs/scoring.md](scoring.md) — the load-bearing rule throughout is
that every point on every score traces to a real, observed signal; a signal that was never
checked is `null`, never a fabricated `0`.

## AI & outreach

Phase 4 added `AIProvider` (mock/local-Ollama/external-Anthropic — see
[docs/ai.md](ai.md)) and the `apps/api/src/ai` module, which turns the Digital Intelligence
Engine's verified data into a lead summary, growth analysis, recommended services, and
personalized outreach/follow-up messages — generated only on explicit request, cached where
recomputation would be wasteful, and never automated into bulk messaging.

## Planned modules (not yet implemented)

crm, campaigns, analytics, audit-log, settings — see [docs/roadmap.md](roadmap.md) for
sequencing.
