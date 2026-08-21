# LeadRadar

**Find leads. Spot opportunities. Start conversations.**

LeadRadar is a lead-intelligence and client-prospecting platform for freelancers,
agencies, marketers, web developers, SEO professionals, and sales teams. It
discovers local businesses, enriches their public information, audits their digital
presence, scores the opportunity, and helps you start the right conversation — then
tracks the result through a lightweight CRM.

Every feature works out of the box with **zero paid accounts** — see
[Demo mode](#demo-mode).

## Product

Given a search ("Dental Clinic" in "Banani, Dhaka"), LeadRadar:

1. Finds real local businesses (or realistic mock ones in demo mode).
2. Crawls each business's own website (bounded, respectful, SSRF-hardened — see
   [Security](#security)) to extract contact info, tech stack, and digital-presence
   signals.
3. Cross-references their Google Business presence.
4. Computes explainable audit scores (SEO, mobile, conversion, technical,
   accessibility, Google profile) and an overall **Opportunity Score** — every
   number traces back to a real observed signal, never fabricated.
5. Surfaces concrete **growth opportunities** with evidence and a recommendation.
6. Generates an AI-written insight summary and an outreach message — grounded only
   in the verified data above, never inventing business facts.
7. Tracks the lead through a Kanban CRM pipeline with notes, tags, and follow-ups.
8. Rolls all of it up into a live analytics dashboard and campaign management.

## Features

- **Lead discovery** — search by category + location, with filters, a live map, and
  bulk-save into your CRM.
- **Digital Intelligence Engine** — website audit (SEO/mobile/conversion/technical/
  accessibility), Google Business audit, and an explainable Opportunity Score. See
  [docs/scoring.md](docs/scoring.md) for the exact formulas.
- **AI insight & outreach** — lead summaries, growth-opportunity analysis, ruled-based
  recommended services, and outreach/follow-up message generation across 5 channels ×
  4 tones × 3 languages. See [docs/ai.md](docs/ai.md).
- **CRM** — Kanban pipeline (drag-and-drop), lead detail with notes/tags/follow-ups,
  saved leads, and search history.
- **Campaigns** — bulk outreach message generation against a targeted lead list, with
  a per-campaign performance dashboard.
- **Analytics** — a live dashboard (8 metrics, 8 charts, recent leads, top
  opportunities) and a filterable analytics view, computed entirely from real data —
  nothing hardcoded.
- **Audit log** — every security-relevant account/organization action (login,
  password change, invitations, role changes) is recorded and viewable in-app.
- **Multi-tenant orgs** — invitations, roles (Owner/Admin/Member/Viewer), and strict
  per-organization data isolation.

## Architecture

```
apps/
  web/      Next.js 16 (App Router) — marketing site + authenticated product
  api/      NestJS 11 REST API
  worker/   BullMQ background job worker (lead discovery, website crawling/audits, follow-up reminders)
packages/
  providers/  Pure, framework-free provider abstractions (lead discovery, AI, website crawler, audit scoring) — the zero-cost mock/local defaults live here, one interface away from a real paid implementation
  types/      Shared TypeScript contracts
  db/         Generated Prisma client, shared by api + worker
  ui/         Shared brand assets & cross-app React primitives
docker/     Dockerfiles + docker-compose.yml
docs/       Deep-dive docs (architecture, scoring, AI, security, deployment, roadmap)
```

Full write-up: [docs/architecture.md](docs/architecture.md).

**Provider abstraction** is the core design pattern: lead discovery and AI generation
each sit behind an interface with a mock (and, for AI, a local-Ollama) implementation
that needs zero external accounts — the paid Google Places / hosted-AI implementations
are optional, server-side-only, and swapped in purely via config. See
[Demo mode](#demo-mode).

## Tech stack

| Layer    | Technology                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, Zustand, React Hook Form, Zod, Recharts, `cmdk` |
| Backend  | NestJS 11, TypeScript, REST, Prisma, `nestjs-pino` structured logging, Swagger/OpenAPI |
| Database | PostgreSQL                                                                                                       |
| Jobs     | Redis, BullMQ                                                                                                    |
| Auth     | httpOnly cookie sessions, argon2 password hashing, opaque rotated refresh tokens, org-scoped RBAC                |
| Infra    | Docker, Docker Compose, GitHub Actions CI                                                                        |
| Testing  | Jest (api unit + e2e), Vitest (worker, providers), Playwright (browser e2e)                                      |

## Screenshots

_Add screenshots of the dashboard, lead audit page, pipeline, and campaign view here
before publishing — e.g. `docs/screenshots/dashboard.png`._

## Setup

### 1. Install dependencies

```bash
corepack enable
pnpm install
```

### 2. Configure environment

```bash
pnpm setup
```

Copies each app's `.env.example` to its working `.env`/`.env.local`, without
overwriting anything that already exists. Defaults work for local dev with zero
external accounts — see [Demo mode](#demo-mode).

### 3. Start infrastructure (Postgres + Redis)

```bash
pnpm docker:up
```

Starts only Postgres and Redis via Docker Compose — the apps themselves run locally
with hot reload. To run the full containerized stack instead, see
[docs/deployment.md](docs/deployment.md#local-docker-compose).

**No Docker available?** Run these instead, each in its own terminal:

```bash
pnpm dev:db      # persistent embedded Postgres on port 5433, no install required
pnpm dev:redis   # portable Redis build on port 6379
```

Then point `DATABASE_URL` in `apps/api/.env` and `apps/worker/.env` at port 5433
instead of 5432.

### 4. Run database migrations

```bash
pnpm --filter api run prisma:migrate
```

### 5. Seed the demo dataset (optional but recommended)

```bash
pnpm --filter api run db:seed
```

Populates one organization with 200 realistic leads across 10 categories, 8 Dhaka
locations, full audit/CRM/campaign history, and a working login
(`demo@leadradar.app` / `demo12345`) — see [Database](#database) and
[Demo mode](#demo-mode).

### 6. Start the apps

```bash
pnpm dev            # web + api + worker, in parallel
# or individually:
pnpm dev:web        # http://localhost:3000
pnpm dev:api        # http://localhost:4000 — API docs at /api/docs
pnpm dev:worker     # health on http://localhost:4100/health
```

## Environment variables

Full reference with inline comments: root [`.env.example`](.env.example) and each
app's own `.env.example`. Summary table:
[docs/deployment.md#environment-variables](docs/deployment.md#environment-variables).

## Database

PostgreSQL via Prisma. Schema: `apps/api/prisma/schema.prisma`. Migrations live in
`apps/api/prisma/migrations` and are the single source of truth for schema changes —
`packages/db`'s generated client is shared by `api` and `worker` so both talk to the
database through one identical schema.

```bash
pnpm --filter api run prisma:migrate    # dev: create + apply a migration
pnpm --filter api run prisma:deploy     # prod: apply existing migrations, non-interactive
pnpm --filter api run prisma:studio     # browse the database
pnpm --filter api run db:seed           # populate the demo dataset (see below)
```

### Demo dataset

`apps/api/prisma/seed.ts` creates one organization ("Demo Agency") with:

- **200 leads** across 10 business categories × 8 Dhaka neighborhoods, all with
  unique generated names
- A realistic mix of has-website / no-website, rated / unrated, and operational /
  temporarily-closed businesses
- ~75% fully audited (website audit, opportunity score, Google Business profile,
  growth opportunities, contacts, social profiles) and ~25% left un-audited, so the
  CRM shows both "before" and "after" states
- AI insights and outreach messages (draft and sent) for engaged leads
- Notes, tags (8 predefined), follow-ups (pending/done/cancelled), and saved-lead
  bookmarks spread realistically across the pipeline stages (New → Contacted →
  Replied → Interested → Meeting → Proposal → Won/Lost)
- 6 past searches with result history, and 3 campaigns (draft/active/completed) with
  their own outreach messages
- 10 notifications

Deterministic (seeded PRNG) — re-running against a fresh database produces the same
dataset every time. Gated by `MOCK_DATA` — set `MOCK_DATA=false` to skip it in an
environment with real data.

## Redis

Used by BullMQ for three background job queues (lead discovery, lead
enrichment/website-audit, follow-up reminders). `pnpm docker:up` runs it locally; see
[docs/deployment.md](docs/deployment.md#redis--upstash-or-compatible) for a
free-tier-compatible hosted option.

## Demo mode

The entire product works with **zero paid API accounts**:

```
MOCK_GOOGLE=true   # lead discovery returns realistic mock businesses
MOCK_AI=true       # AI features use deterministic template generation
MOCK_DATA=true     # `pnpm db:seed` populates the demo dataset above
```

All three default to `true`. Full explanation, the real-provider opt-in path, and
what each flag actually gates: [docs/deployment.md#demo-mode](docs/deployment.md#demo-mode).

## Google integration

Optional. Uses the official Places API (New) — server-side only, minimal field masks,
no scraping, no browser automation, no CAPTCHA bypass, proper attribution (every
Google-sourced result links back to its Google Maps listing). Full review:
[docs/security.md#google-api-review](docs/security.md#google-api-review).

## AI integration

Optional beyond the always-available mock mode. Three modes: `mock` (default, zero
cost), `local` (Ollama, zero cost, nothing leaves your machine), `external` (a real
hosted AI API, opt-in, falls back to mock if unconfigured). The AI provider
structurally cannot invent business facts — it only ever receives verified,
already-computed signals, never a free-text "make something up" surface. Full
architecture: [docs/ai.md](docs/ai.md). Review: [docs/security.md#ai-review](docs/security.md#ai-review).

## Deployment

Docker Compose (local, full containerized stack) and one free-tier-compatible cloud
path (Vercel + a Node host + Supabase/Neon + Upstash), including honest limitations
of relying on free tiers: [docs/deployment.md](docs/deployment.md).

## Docker

```bash
pnpm docker:up          # Postgres + Redis only (for local `pnpm dev`)
pnpm docker:up:full      # full containerized stack — web, api, worker, postgres, redis
pnpm docker:down
pnpm docker:logs
```

Dockerfiles: `docker/{web,api,worker}.Dockerfile`. The `api` container runs
`prisma migrate deploy` automatically on every start. See
[docs/deployment.md](docs/deployment.md#local-docker-compose) for required secrets
and the seeding step.

## API documentation

Swagger/OpenAPI UI at **`/api/docs`** once the API is running (`http://localhost:4000/api/docs`
locally). Covers auth, search, leads, audit, AI & outreach, CRM, analytics, campaigns,
organizations, notifications, and the audit log. Auth in the docs UI is cookie-based —
log in via the app first, or drive requests from a session that already has the
cookie set.

## Health checks

- `GET /health` and `GET /ready` (api, `:4000`) — check Postgres, Redis, and report
  which demo-mode flags are active. Intentionally identical endpoints (two
  conventional names, one check) — see the comment in `health.controller.ts`.
- `GET /health` (worker, `:4100`) — checks Redis connectivity.
- `GET /api/health` (web, `:3000`) — liveness check for the Next.js server.

## Testing

```bash
pnpm lint          # all workspaces
pnpm typecheck     # all workspaces
pnpm test          # api unit + e2e (own throwaway Postgres, mocked Redis), worker unit, provider unit
pnpm build          # production build, all apps
```

Browser end-to-end (the full golden path — register → search → save → audit →
AI insight → outreach → pipeline → analytics) via Playwright:

```bash
pnpm dev:db && pnpm dev:redis && pnpm dev   # or pnpm docker:up + pnpm dev
pnpm --filter web run test:e2e
```

Not run in CI (see [CI](docs/deployment.md#ci)) — it needs the full stack live
simultaneously plus a Chromium install, which is a heavier CI setup than this
project's size currently justifies. Run it locally/manually, or via `--ui` for a
step-through: `pnpm --filter web run test:e2e:ui`.

## Security

Authentication, cookies, authorization/org isolation, CORS, rate limiting, input
validation, SQL injection, XSS, CSRF, secrets handling, logging/redaction, and — the
most substantial finding — an SSRF hardening pass on the website crawler (blocks
localhost/private/link-local/cloud-metadata addresses and DNS rebinding, caps
redirects). Full review, what was found, and what changed:
[docs/security.md](docs/security.md).

## Privacy & data considerations

- LeadRadar only stores **publicly available business information** (name, address,
  category, public contact details, public website content, public Google Business
  listing data) — it does not scrape personal social media profiles, does not attempt
  to identify private individuals, and does not store payment or other sensitive
  personal data about the businesses it profiles.
- The website crawler identifies itself with a real, non-spoofed `User-Agent`
  (`LeadRadarBot/1.0`), respects `robots.txt`, and is bounded (max 5 pages, same
  homepage-discovered links only, rate-limited between requests) — it is not a
  general-purpose scraper.
- User accounts (the people using LeadRadar) store an email, name, and hashed
  password — see [Security](#security) for how those are protected.
- No data is sent to a third party beyond the two optional, explicitly-configured
  providers (Google Maps Platform, a hosted AI API) — and only when their respective
  `MOCK_*` flag is turned off.

## Known limitations

- **Marketing pages**: `/features` and `/pricing` are not built yet — pricing is
  currently shown inline on the landing page, explicitly labeled "Product concept —
  billing isn't live yet." See [docs/roadmap.md](docs/roadmap.md).
- **Free-tier hosting**: not guaranteed to stay free or available — see
  [docs/deployment.md#free-tier-limitations](docs/deployment.md#free-tier-limitations-read-this-before-you-rely-on-it).
- **No automated dependency vulnerability scanning** in CI yet (e.g. `pnpm audit`,
  Dependabot) — see [docs/security.md#known-limitations](docs/security.md#known-limitations).
- **Browser e2e tests aren't gated in CI** — see [Testing](#testing).
- This has not undergone a third-party security audit or penetration test.

## Roadmap

Phase-by-phase build history and what's next: [docs/roadmap.md](docs/roadmap.md).

## License

Unlicensed / private — all rights reserved.
