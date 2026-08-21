# Deployment

LeadRadar is designed to run as three services (web, api, worker) plus Postgres and
Redis. This doc covers running it locally via Docker, and one path to a free-tier
cloud deployment. **None of the providers named below are guaranteed to stay free —
see [Free-tier limitations](#free-tier-limitations-read-this-before-you-rely-on-it)
before you build anything on top of this for real.**

## Demo mode

Set these three (all default to `true` — see `.env.example`):

```
MOCK_GOOGLE=true
MOCK_AI=true
MOCK_DATA=true
```

With all three true, the entire product works with **zero external accounts and zero
cost**: lead discovery returns realistic mock businesses instead of calling Google,
AI features (summaries, growth analysis, outreach) generate deterministic
template-based content instead of calling a real AI API, and `pnpm db:seed`
populates a full demo dataset (50+ distinct businesses / 200 leads across multiple
categories, locations, ratings, audit scores, opportunity levels, CRM pipeline
stages, activities, notes, and tags — see `apps/api/prisma/seed.ts`).

Flip a flag to `false` once you've configured the matching real credentials (each
still falls back to mock automatically if the credentials are missing — see
`configuration.ts`):

| Flag | Real provider | Needs |
|---|---|---|
| `MOCK_GOOGLE=false` | Google Maps Platform (Places API) | `GOOGLE_MAPS_ENABLED=true` + `GOOGLE_MAPS_API_KEY` |
| `MOCK_AI=false` | Ollama (local) or a hosted AI API | `AI_MODE=local` (+ `OLLAMA_*`) or `AI_MODE=external` + `AI_API_KEY` |
| `MOCK_DATA=false` | — | Just skips `pnpm db:seed`'s synthetic dataset; no external account needed |

## Environment variables

See `.env.example` (root) for the full reference list with inline comments, and each
app's own `.env.example` (`apps/api`, `apps/worker`, `apps/web`) for what that
specific process actually reads. Summary:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | api, worker | Postgres connection string |
| `REDIS_URL` | api, worker | Redis connection string (BullMQ queues) |
| `JWT_SECRET` | api | Signs access-token JWTs — **required, no safe default in prod** |
| `JWT_REFRESH_SECRET` | api | Reserved for future use (see docs/security.md) — still required to differ from a placeholder in prod |
| `COOKIE_SECRET` | api | Signs cookies — **required, no safe default in prod** |
| `NEXT_PUBLIC_API_URL` | web | Where the browser sends API requests |
| `API_URL` | web | Where the Next.js server sends API requests (can differ from the public URL in a Docker network) |
| `GOOGLE_MAPS_API_KEY` | api, worker | Places API key — server-side only, never exposed to the browser |
| `GOOGLE_MAPS_ENABLED` | api | Opt-in to real Google Places (still needs `MOCK_GOOGLE=false` too) |
| `AI_MODE` | api | `mock` / `local` / `external` |
| `AI_API_KEY` | api | Hosted AI API key (`external` mode) |
| `AI_MODEL` | api | Model name for `local`/`external` mode |
| `MOCK_DATA` | api | Gates `pnpm db:seed`'s synthetic dataset |
| `MOCK_GOOGLE` | api | Forces lead discovery to mock regardless of `GOOGLE_MAPS_ENABLED` |
| `MOCK_AI` | api | Forces AI generation to mock regardless of `AI_MODE` |

## Local: Docker Compose

```bash
cp .env.example .env    # then set JWT_SECRET / JWT_REFRESH_SECRET / COOKIE_SECRET —
                         # required, not defaulted, for the full profile (see below)
pnpm docker:up:full      # builds and starts postgres, redis, api, worker, web
```

The `full` profile builds and runs the actual production container images
(`docker/*.Dockerfile`) with `NODE_ENV=production` — this is deliberately held to the
same standard as a real deployment, so it refuses to start with the insecure
placeholder secrets from `.env.example` (the API's own startup guard would refuse
anyway; the compose file fails faster with a clearer message). Generate real ones
locally too: `openssl rand -base64 32`.

The `api` container runs `prisma migrate deploy` automatically on every start (a
no-op once the schema is current) before starting the server. Seeding is **not**
automatic — run it once, manually, after the stack is up:

```bash
docker compose -f docker/docker-compose.yml exec api node_modules/.bin/prisma db seed
```

For local development without the full container build (hot reload, faster
iteration), use `pnpm docker:up` (Postgres + Redis only) and run the three apps
directly with `pnpm dev` — see the root README's Getting Started section.

## Cloud: one free-tier-compatible path

This is one reasonable combination, not the only one. Swap any piece for an
equivalent provider.

### Database — Supabase or Neon (PostgreSQL-compatible)

Either works unmodified — the app only needs a standard `DATABASE_URL` connection
string. Create a project, copy its connection string into `DATABASE_URL`, then run
migrations against it once:

```bash
DATABASE_URL="<your connection string>" pnpm --filter api exec prisma migrate deploy
DATABASE_URL="<your connection string>" pnpm --filter api run db:seed   # optional demo data
```

Both Supabase and Neon require SSL for external connections — append
`?sslmode=require` to the connection string if it isn't already there.

### Redis — Upstash or compatible

Upstash's free tier offers a REST-compatible Redis instance; use its standard
`rediss://` connection string as `REDIS_URL`. BullMQ (the queue library both `api`
and `worker` use) works over a standard Redis protocol connection, not Upstash's REST
API specifically — use the "Redis protocol" / `ioredis`-compatible connection string
Upstash provides, not the REST URL.

### Backend (api + worker) — any free-tier-compatible Node host

Render, Railway, Fly.io, and similar all work: point them at this repo, set the build
command to build `api`/`worker` per `docker/api.Dockerfile` / `docker/worker.Dockerfile`
(or use the Dockerfiles directly if the platform supports it), and set the env vars
from the table above. Each needs to run as a **persistent** process (not a serverless
function) since both hold long-lived connections (Postgres pool, Redis, BullMQ
workers) — most free tiers support this but may sleep the service after a period of
inactivity, which adds cold-start latency to the first request after idle.

### Frontend — Vercel

`apps/web` is a standard Next.js App Router project — deploy it to Vercel by pointing
a new project at this repo with **Root Directory** set to `apps/web`. Set
`NEXT_PUBLIC_API_URL` to your deployed api's public URL. No other Vercel-specific
configuration is needed.

## CI

`.github/workflows/ci.yml` runs install → lint → typecheck → test → build on every
push/PR. There is no automatic deploy step in this repository — deployment happens
through each platform's own git integration (Vercel/Render's dashboard, typically
triggered by a push to the deploy branch). To make sure a broken build never reaches
production, turn on **required status checks** for this CI workflow in your repo's
branch protection settings, and point your hosting platform's deploy trigger at the
same protected branch — that way nothing merges (and therefore nothing deploys)
without CI passing first.

## Free-tier limitations (read this before you rely on it)

**None of the providers mentioned in this document are guaranteed to stay free, and
none of these claims are promises made on their behalf.** As of when this was
written, Vercel, Render, Railway, Fly.io, Supabase, Neon, and Upstash all publish a
free/hobby tier, but every one of them:

- Can change pricing, limits, or free-tier availability at any time, without notice
  to this project.
- Typically caps compute hours, storage, bandwidth, or request volume — a real-world
  demo that gets meaningful traffic can exceed a free tier faster than expected.
- Often sleeps/cold-starts idle free-tier services, which is fine for a portfolio demo
  and not fine for anything latency-sensitive.
- May require a credit card on file even for the "free" tier, and may auto-upgrade to
  paid usage if a limit is exceeded, depending on the provider's own policies.

Check each provider's current pricing page before deploying, and don't treat this
document as a guarantee that any part of this stack costs $0 to run in production.
