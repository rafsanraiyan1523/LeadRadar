# Deployment plan — LeadRadar → Vercel + Render + Supabase/Neon + Upstash

This document is the result of a fresh, file-by-file audit of this exact repository
(originally audited at commit `2a879b4`, 2026-08-22), not a generic guide. Every claim
below is backed by a specific file. Part 1 (repository audit) reflects the state at the
time of the original audit; **Part 2 has since been updated** — findings 1–4 were fixed
in code (with tests), finding 5 was evaluated and left unchanged, finding 6 is
documented, not coded. Part 3 (deployment plan) has been updated to match the fixes
actually applied. No deployment has been performed.

---

## Part 1 — Repository audit (as it actually is)

### 1. Exact monorepo structure

pnpm workspace, defined in [`pnpm-workspace.yaml`](../pnpm-workspace.yaml):

```
packages:
  - "apps/*"
  - "packages/*"
```

```
LeadRadar/
  apps/
    web/      Next.js 16 frontend
    api/      NestJS 11 REST API
    worker/   BullMQ background worker (plain Node, no framework)
  packages/
    types/       @lead-radar/types    — shared TS contracts, built via tsc
    providers/   @lead-radar/providers — lead-discovery/AI/crawler/audit logic, built via tsc
    db/          @lead-radar/db       — generated Prisma client only (no source, no build script)
    ui/          @lead-radar/ui       — shared React components, consumed as raw TS (no build)
    eslint-config/ — shared flat ESLint config
    config/      — (present, shared tsconfig base)
  docker/        Dockerfiles + docker-compose.yml
  docs/          this file and others
  .github/workflows/ci.yml — install/lint/typecheck/test/build, no deploy step
```

Package manager: **pnpm `11.22.0`** (pinned via root `package.json`'s `"packageManager"`
field). `"engines"`: `node >=20.0.0`, `pnpm >=9.0.0`.

### 2. Frontend framework and location

`apps/web` — **Next.js `16.3.1`** (App Router), React `19.2.8`. Confirmed in
`apps/web/package.json` and `apps/web/next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@lead-radar/ui", "@lead-radar/types"],
};
```

`output: "standalone"` exists for the Docker path (`docker/web.Dockerfile` copies
`.next/standalone`) — it is inert on Vercel, which uses its own build pipeline and does
not need or use this setting. Not a blocker either way.

### 3. Backend framework and location

`apps/api` — **NestJS `11.0.1`** REST API, Express platform (`@nestjs/platform-express`).
Entry point `apps/api/src/main.ts`. Listens via `app.listen(port)` with no explicit host
(binds all interfaces — fine for Render).

### 4. Worker location

`apps/worker` — plain TypeScript/Node, no framework. Entry point
`apps/worker/src/main.ts`. Registers three BullMQ `Worker` instances (lead discovery,
lead enrichment, follow-up reminders) and starts a minimal `node:http` health server on
its own port. Graceful `SIGTERM` shutdown is already implemented (closes all three
workers + Prisma before exiting) — this matters for Render's redeploy/restart cycle.

### 5. Package manager

**pnpm**, workspace-aware. All build/start commands below assume `pnpm` is available in
the deploy environment (Render's Node runtime supports it; corepack enables it —
`RUN corepack enable` is already the first line of every Dockerfile).

### 6. Build commands (as literally defined)

| Package | Script | Command |
|---|---|---|
| root | `build:packages` | `pnpm --filter api run prisma:generate && pnpm --filter @lead-radar/types run build && pnpm --filter @lead-radar/providers run build` |
| root | `build` | `pnpm run build:packages && pnpm -r --filter ./apps/* run build` |
| `apps/api` | `build` | `nest build` |
| `apps/worker` | `build` | `tsc -p tsconfig.json` |
| `apps/web` | `build` | `next build` |

`@lead-radar/types` and `@lead-radar/providers` are **not source-consumed** by
`apps/api`/`apps/worker` — both resolve them via `package.json`'s `"main": "./dist/index.js"`,
so they must be built (`tsc`) *before* `apps/api`/`apps/worker` build or start. `@lead-radar/db`
has no build script at all — its `generated/` directory is produced entirely by
`prisma generate`, which is why `build:packages` runs `prisma:generate` first.
`packages/db/generated/` and every `dist/` are **gitignored** (verified: `git ls-files`
returns nothing for either) — nothing pre-built is committed, so every deploy target
must actually run these steps itself.

### 7. Start commands (as literally defined)

| Package | Script | Command |
|---|---|---|
| `apps/api` | `start:prod` | `node dist/main` |
| `apps/worker` | `start` | `node dist/main.js` |
| `apps/web` | `start` | `next start` (not used for Vercel — Vercel manages this itself) |

### 8. Prisma configuration

`apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../../../packages/db/generated"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- No `binaryTargets` override — Prisma defaults to `["native"]`, auto-detecting whatever
  platform `prisma generate` actually runs on. This is correct **as long as `prisma
  generate` runs fresh on the deploy platform itself** (which it will, per point 6/9 —
  there is no committed, pre-built client to accidentally reuse from this Windows dev
  machine).
- No `directUrl` field. See finding **#5** below for what this means for Supabase's
  pooled connection string.
- 7 migrations exist in `apps/api/prisma/migrations/` (`init` through
  `campaigns_and_analytics`), plus `migration_lock.toml` (provider lock = `postgresql`).
- Seed script: `apps/api/prisma/seed.ts`, wired via `apps/api/package.json`'s
  `"prisma": { "seed": "ts-node --transpile-only prisma/seed.ts" }` and a `db:seed` npm
  script (`prisma db seed`). Gated by `MOCK_DATA` (skips entirely if `MOCK_DATA=false`).

### 9. Database configuration

Single env var: `DATABASE_URL`, read by Prisma via `env("DATABASE_URL")` in the schema
(not through `apps/api`'s own config layer — `configuration.ts` also reads it into
`AppConfig.databaseUrl`, but that field isn't actually passed to Prisma anywhere; Prisma
reads `process.env.DATABASE_URL` directly, standard Prisma behavior). Both `apps/api`
and `apps/worker` connect with the **same** generated client (`@lead-radar/db`) against
the **same** database — `apps/worker/src/lib/prisma.ts` instantiates its own
`PrismaClient`, `apps/api/src/prisma/prisma.service.ts` extends it with Nest lifecycle
hooks. No connection-pool size is configured explicitly anywhere (Prisma's default
pool applies).

### 10. Redis configuration

Single env var: `REDIS_URL`, consumed via `ioredis`. Three **separate** ioredis
connections exist in the running system:
- `apps/api/src/redis/redis.module.ts` — one connection for the API's own health check
  + as the base connection BullMQ's `Queue` producers share (`QueueModule`).
- `apps/worker/src/lib/redis.ts` — one connection, shared by the worker's `Queue`/`Worker`
  registry (`apps/worker/src/queues/registry.ts`).

Both correctly set `maxRetriesPerRequest: null` — this is **required** by BullMQ (not
optional tuning) since BullMQ issues blocking commands that must not be retried by
ioredis itself. Already correct in both places, no change needed.

### 11. BullMQ configuration

Three queues, names defined once in `@lead-radar/types` and imported by both sides so
producer (api) and consumer (worker) can never drift:
`LEAD_DISCOVERY_QUEUE`, `LEAD_ENRICHMENT_QUEUE`, `FOLLOW_UP_REMINDER_QUEUE`.
Default job options (both `apps/api/src/queue/queue.module.ts` and
`apps/worker/src/queues/registry.ts`, kept in sync by hand — not shared code):
`attempts: 3`, exponential backoff starting at 2000ms, `removeOnComplete: 500`,
`removeOnFail: 1000`. The api only **produces** (enqueues) jobs; only the worker
**consumes** them — the api never runs a BullMQ `Worker`.

### 12. All environment variables (verified from source, not `.env.example` alone)

See **Part 3, Section F** for the full table with exact defaults and read locations.

### 13. Frontend API configuration

Two separate small fetch wrappers, both in `apps/web/src/lib/`:

- **`api-client.ts`** (client components): `const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"`.
  Every request sets `credentials: "include"`.
- **`server-api.ts`** (server components/route handlers): `const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"`.
  Manually forwards the incoming request's `Cookie` header (server-side `fetch` has no
  browser attached, so there's nothing to "include" — this is the correct pattern).

So: `NEXT_PUBLIC_API_URL` is required (browser calls); `API_URL` is optional and only
matters if you want the Next.js *server* to reach the API by a different address than
the public one (e.g. an internal network address) — for this deployment target (Render
web service, no private networking configured), set both to the same public API URL.

### 14. CORS configuration

`apps/api/src/main.ts`:

```ts
app.enableCors({
  origin: config.get('webOrigin', { infer: true }),
  credentials: true,
});
```

Single explicit origin string, from `WEB_ORIGIN`. Not a wildcard, not a regex, not an
array — exactly one allowed origin. This will need to be your production Vercel URL
(custom domain if you set one, otherwise the `*.vercel.app` URL). Vercel's per-branch/PR
**preview** deployments get their own distinct URLs and will **not** match `WEB_ORIGIN`
— preview deployments will be CORS-blocked from calling the API. Not a blocker for
getting production live; only relevant if you also want preview deployments to work
against the same backend.

### 15. Authentication / session configuration

Cookie-based, not bearer-token. `apps/api/src/auth/lib/cookies.ts`:

```ts
function baseCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
  };
}
```

- `lr_access_token` (path `/`, short-lived JWT) and `lr_refresh_token` (path `/auth`
  only, opaque random value hashed at rest) — see finding **#1**, this is the most
  important blocker in this whole audit.
- `apps/api/src/main.ts` has a **startup guard**: refuses to boot with
  `NODE_ENV=production` if `COOKIE_SECRET`/`JWT_SECRET` are empty, equal to each other,
  or still the literal dev-placeholder strings from `.env.example`. This is a genuine
  safety net, not decoration — Render deploys **will fail to start** if you forget to
  set real values for these two.

### 16. Docker configuration

Three Dockerfiles (`docker/{web,api,worker}.Dockerfile`) + `docker/docker-compose.yml`
(profiles: default = postgres+redis only, `full` = all five services). All three
Dockerfiles use `node:20-alpine`, multi-stage builds, `pnpm deploy --prod` to produce a
trimmed production `node_modules`. **`docker/api.Dockerfile` has a real bug — see
finding #2.** `docker/worker.Dockerfile` is correct (it does build `@lead-radar/providers`).
`docker/api.Dockerfile`'s `CMD` already runs `prisma migrate deploy` before starting
(`node_modules/.bin/prisma migrate deploy && node dist/main.js`) — this is correct and
convenient, but relies on `prisma` being a **production** dependency of `apps/api`
(confirmed: it is — `apps/api/package.json`'s `dependencies` includes `"prisma": "^5.22.0"`,
not just `devDependencies`, which is required for this to work in the trimmed
`pnpm deploy --prod` output).

### 17. Production scripts

Covered in points 6–7. No `Procfile`, no `render.yaml`, no `vercel.json` exist in the
repo (verified) — nothing pre-configures either platform; everything below is built
from what Render/Vercel's dashboards let you configure directly.

### 18. Can the project run successfully in mock mode?

**Yes — extensively verified in this repository's own history** (see
`docs/security.md`, `docs/roadmap.md`). `MOCK_GOOGLE=true` / `MOCK_AI=true` /
`MOCK_DATA=true` are the defaults in every `.env.example` in this repo. With all three
true: lead discovery uses `MockLeadDiscoveryProvider` (no Google account needed), AI
generation uses deterministic templates (no AI account needed), and
`apps/api/prisma/seed.ts` populates a full demo dataset (200 leads) when run. No code
path requires a paid credential to function.

### 19. Deployment blockers found

Six findings, detailed with exact fixes in Part 2. Two are **critical** (the deployment
will not work correctly without them): the cross-domain cookie `SameSite` setting, and
the missing `@lead-radar/providers` build step in `docker/api.Dockerfile`.

---

## Part 2 — Findings and their resolutions

Six findings were identified in the initial audit. Findings 1, 2, and 4 have now been
**fixed** in code (with tests). Findings 3 has been fixed via a config-layer change
(reading `PORT` first). Finding 5 was evaluated and **no change was made** — the
deployment plan uses a direct connection string, so `directUrl` isn't needed. Finding 6
is informational only, addressed by documentation (this file), not code.

### Finding 1 — CRITICAL: cross-domain auth would silently break — FIXED

**FILE:** `apps/api/src/auth/lib/cookies.ts` (function `baseCookieOptions`)

**PROBLEM:** `sameSite: 'lax'` was hardcoded. Vercel (e.g. `leadradar.vercel.app`) and
Render (e.g. `leadradar-api.onrender.com`) are different registrable domains — a
genuinely **cross-site** relationship. Browsers never attach a `SameSite=Lax` cookie to
a cross-site `fetch`/XHR request (regardless of `credentials: "include"` on the client,
already correct in `apps/web/src/lib/api-client.ts`) — only to top-level navigations
with safe methods. Login's `Set-Cookie` would still succeed, but every subsequent API
call would arrive with no cookie, so the user would appear logged out immediately.

**FIX APPLIED:** `baseCookieOptions` now computes `isProduction = config.nodeEnv ===
'production'` once and returns `secure: isProduction, sameSite: isProduction ? 'none' :
'lax'`. Production gets `SameSite=None; Secure` (required together — browsers reject
`None` without `Secure`); development keeps `SameSite=Lax`, non-`Secure`, so plain HTTP
`localhost` continues to work unchanged. No `domain` attribute is set in either case —
frontend and API are separate domains, not subdomains of one site, so a `Domain`
attribute would be meaningless. `clearAuthCookies` shares the same `baseCookieOptions()`
call as `set*Cookie`, so cookie clearing automatically uses matching attributes in both
environments — this was already the existing structure, not something that needed
separate fixing.

**TESTS:** `apps/api/src/auth/lib/cookies.spec.ts` (new, 12 tests) — covers both
environments for the access token cookie, the refresh token cookie, and
`clearAuthCookies`; asserts `SameSite=None` is never set without `Secure`; asserts
`maxAge`/`path`/`httpOnly` are all still correct; asserts no `domain` attribute is ever
set.

---

### Finding 2 — CRITICAL: `docker/api.Dockerfile` would produce a broken image — FIXED

**FILE:** `docker/api.Dockerfile`

**PROBLEM:** The build stage built `@lead-radar/types` but never
`@lead-radar/providers`, even though `apps/api/src` imports it in 8 files. Would fail
`nest build`'s typecheck, or ship a runtime image that crashes the moment any of those 8
files' code path runs.

**FIX APPLIED:** Added the one missing line, matching the pattern `docker/worker.Dockerfile`
already used correctly:
```diff
 RUN pnpm --filter @lead-radar/types run build
+RUN pnpm --filter @lead-radar/providers run build
 RUN pnpm --filter api run build
```

**VERIFICATION:** A real `docker build` could not be run in this environment (no
hardware virtualization available on this machine — same limitation noted in the
original audit). Verified instead by reproducing the exact build-stage command sequence
outside Docker (fresh `pnpm install`, clean `dist`/`generated` directories, then the
identical `RUN` lines in the identical order), then running `pnpm --filter=api deploy
--prod` and starting the resulting `dist/main.js` against local Postgres/Redis — see
Part 4 (Validation results) for the exact commands and outcome.

---

### Finding 3 — HIGH: port mismatch with Render's `PORT` convention — FIXED

**FILE:** `apps/api/src/config/configuration.ts`

**PROBLEM:** The api read `process.env.API_PORT ?? 4000` only. Render auto-injects
`PORT` and expects the process to bind to it.

**FIX APPLIED:** `port: Number(process.env.PORT ?? process.env.API_PORT ?? 4000)` — `PORT`
is read first (Render's convention), `API_PORT` remains a supported fallback (this
project's original name, still what `docker-compose.yml`'s `api` service sets, and still
usable for local dev), `4000` is the final default (kept, not changed to `3000` — that's
the **web** app's port; `4000` has always been this api's actual default across its
Dockerfile `EXPOSE`, docker-compose health check, and README references, so keeping it
avoids introducing an inconsistency). No other file needed changes — `main.ts` already
just calls `config.get('port', { infer: true })`.

**Render configuration required:** none beyond normal — Render's auto-injected `PORT`
now works with zero extra dashboard configuration. (`API_PORT` doesn't need to be set on
Render at all now; it's only relevant to local/Docker-Compose dev, where `PORT` is
never set and the fallback chain reaches `API_PORT`/`4000` exactly as before.)

**Worker note:** `apps/worker`'s health-check port (`WORKER_HEALTH_PORT`) was **not**
changed — the worker is recommended as a Render *Background Worker* (Part 3, Section C),
which has no `PORT`/routing requirement at all. If you instead deploy the worker as a
Web Service to expose its health endpoint publicly, apply the same manual "set `PORT`
and `WORKER_HEALTH_PORT` to the same value" workaround described in the previous version
of this document — not changed in code since the recommended path (Background Worker)
doesn't need it.

---

### Finding 4 — MEDIUM: rate limiter would mis-bucket all users behind Render's proxy — FIXED

**FILE:** `apps/api/src/main.ts`

**PROBLEM:** The global `ThrottlerModule` (100 req/min) keys by `req.ip`. Express
ignores `X-Forwarded-For` unless told to trust it. Behind Render's reverse proxy,
`req.ip` would resolve to Render's own proxy address for every request, collapsing the
rate limit into one shared bucket for all users combined.

**FIX APPLIED:** `app.set('trust proxy', 1)`, added in `bootstrap()` right after the
production-secrets guard and before `app.enableCors(...)`. `1` trusts exactly one proxy
hop (the immediate one — Render's edge), not an arbitrary chain: a client cannot spoof
its way past this by prepending fake `X-Forwarded-For` entries, since only the
outermost, proxy-appended entry is trusted. This required also typing `app` as
`NestExpressApplication` (from `@nestjs/platform-express`) instead of the default
`INestApplication` — the bare interface doesn't expose Express-specific methods like
`.set()`.

**TESTS:** `apps/api/src/common/trust-proxy.spec.ts` (new, 4 tests) — a minimal Express
app configured the same way (`app.set('trust proxy', 1)`), proving: (a) without it,
`X-Forwarded-For` is ignored entirely (the pre-fix bug); (b) with it, the real client IP
resolves correctly from a single proxy hop; (c) a client-prepended spoofed hop is *not*
trusted; (d) contrasted against `trust proxy: true` (the unsafe alternative, trusting
the whole chain including spoofed entries) to demonstrate why `1` was chosen specifically.
`main.ts` itself isn't imported in tests (it has an import-time bootstrap side effect),
so this proves the exact Express semantics the fix relies on rather than exercising
`main.ts` directly.

**Revisit if:** a CDN or additional proxy is ever placed in front of Render — `1` would
then need to become `2` (or more), matching the real number of hops.

---

### Finding 5 — Prisma direct connection — EVALUATED, NO CHANGE MADE

**FILE:** `apps/api/prisma/schema.prisma` — **left unchanged.**

The deployment plan (Part 3, Section D below) uses Supabase's/Neon's **direct**
(non-pooled) connection string as `DATABASE_URL`, not a PgBouncer-pooled one. A direct
connection doesn't need Prisma's `directUrl` split at all — that split only matters when
`DATABASE_URL` itself is a pooled connection (which can't run `migrate deploy`'s schema
DDL/advisory lock reliably) and you need a *separate* direct URL just for migrations.
Since this deployment never uses a pooled URL as `DATABASE_URL` in the first place,
adding `directUrl` would be unused configuration. If a pooled connection is adopted
later (e.g. for a fleet of serverless functions each opening their own short-lived
connection — not this deployment's shape), revisit this and add
`directUrl = env("DIRECT_DATABASE_URL")` at that point, not before.

---

### Finding 6 — No real email delivery — DOCUMENTED, NO CODE CHANGE

**FILE:** `apps/api/src/mail/console-mail.provider.ts` — unchanged, intentionally.

**Email delivery is not configured in demo mode. Verification and password-reset
messages are logged by the backend**, not sent to a real inbox — the only registered
`MailProvider` (`ConsoleMailProvider`) logs to the server console. No SES/Postmark/SMTP
integration exists, and none is being added as part of this deployment — it would be a
paid or account-requiring service, outside the zero-cost mock-mode target. If you
register a real account or use "forgot password" against the deployed instance, retrieve
the message from the Render service's log stream, not an inbox.

---

## Part 3 — Deployment plan

### A. Frontend deployment configuration (Vercel)

- **Import** this GitHub repo into a new Vercel project.
- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** leave default (`next build`) — Vercel's own dependency
  installation handles the pnpm workspace correctly when Root Directory is set to
  `apps/web`, because Vercel walks up to find the workspace root automatically for
  pnpm-workspace repos. *(If Vercel's build fails to resolve `@lead-radar/types`/`@lead-radar/ui`,
  override the Install Command to `cd ../.. && pnpm install --frozen-lockfile` and Build
  Command to `cd ../.. && pnpm run build:packages && pnpm --filter web run build` — try
  the default first; only add the override if the workspace packages aren't found.)*
- **Output Directory:** leave default (Vercel's Next.js integration detects this itself)
- **Node.js Version:** 20.x (match `engines.node` in root `package.json`)
- **Environment Variables:** see Section F
- **Domain:** production domain (custom, or the default `*.vercel.app` one) — this
  exact value becomes `WEB_ORIGIN` on the backend (Section G).

### B. Backend deployment configuration (Render)

**Option 1 — Docker (recommended — Finding #2 is fixed, so this now builds correctly):**
- **New → Web Service → Build and deploy from a Git repository**
- **Dockerfile Path:** `docker/api.Dockerfile`
- **Docker Build Context Directory:** `.` (repo root — confirmed correct via
  `docker-compose.yml`'s `context: ..` relative to the `docker/` directory, i.e. the
  repo root)
- **Health Check Path:** `/health` (or `/ready` — identical, see Section J)
- Migrations run automatically on every container start (`docker/api.Dockerfile`'s
  `CMD` already runs `prisma migrate deploy` first) — no separate migration step needed
  in Render's dashboard for this option.

**Option 2 — Render native Node runtime (no Docker, sidesteps Finding #2 entirely):**
- **New → Web Service → Build and deploy from a Git repository**
- **Root Directory:** leave at repo root (required for pnpm workspace commands)
- **Build Command:** `pnpm install --frozen-lockfile && pnpm run build:packages && pnpm --filter api run build`
- **Start Command:** `pnpm --filter api run start:prod`
- **Health Check Path:** `/health`
- Migrations are **not** automatic with this option — run
  `pnpm --filter api exec prisma migrate deploy` manually (Render Shell, or as a Render
  "Pre-Deploy Command" if your plan supports it) after each deploy that includes a new
  migration.

Neither option needs any `PORT`-related configuration — the api now reads `process.env.PORT`
first (Finding #3, fixed), so Render's auto-injected value just works.

Either option: **Instance Type** — must be an "always-on" plan, not one that spins down
completely on idle in a way that drops the BullMQ producer's Redis connection
indefinitely (Render's free web service tier does spin down on inactivity and cold-starts
on the next request — acceptable for a demo, adds latency to the first request after
idle; document this as an accepted tradeoff of the free tier, not a bug).

### C. Worker deployment configuration (Render)

Deploy as a **separate** Render service from the api — same repo, different service.

**Recommended: Render "Background Worker" service type** (not "Web Service") — the
worker doesn't need inbound HTTP traffic to do its job (it only consumes BullMQ jobs),
so a Background Worker avoids the whole `PORT`/health-check-routing question for the
main process entirely. Its `/health` endpoint (`WORKER_HEALTH_PORT`, default 4100) still
starts either way — with a Background Worker service type it just isn't reachable from
the public internet, only useful if you exec into the instance or hit it from a private
network. If you want the health endpoint externally reachable for uptime monitoring,
use a **Web Service** instead — the worker's `WORKER_HEALTH_PORT` was *not* changed to
read `PORT` (unlike the api's `API_PORT`, see Finding #3), since the recommended
Background Worker path never needs it. If you do use a Web Service for the worker, set
both `PORT` and `WORKER_HEALTH_PORT` to the same explicit value in Render's dashboard.

**Option 1 — Docker:**
- **Dockerfile Path:** `docker/worker.Dockerfile`
- **Docker Build Context Directory:** `.` (repo root)

**Option 2 — Render native Node runtime:**
- **Root Directory:** repo root
- **Build Command:** `pnpm install --frozen-lockfile && pnpm run build:packages && pnpm --filter worker run build`
- **Start Command:** `pnpm --filter worker run start`

Neither option needs a "migration" step for the worker — it shares the same already-
migrated database as the api; only one service (the api, or whichever runs
`prisma migrate deploy`) should ever apply migrations.

### D. PostgreSQL setup (Supabase or Neon)

1. Create a new project on either platform.
2. Copy the **direct** (non-pooled) connection string — see Finding #5 for why. On
   Supabase this is the connection string shown for "Session" mode / direct connection
   (not the "Transaction"/PgBouncer pooled one on port 6543); on Neon, either
   connection string works, but prefer the one labeled non-pooled if both are offered.
3. Confirm it includes `sslmode=require` (both platforms' provided strings do by
   default) — set as `DATABASE_URL` on both the api and worker Render services.
4. Run migrations once against it (Section H) before first boot, or rely on
   `docker/api.Dockerfile`'s automatic `migrate deploy` on first container start if
   using Option 1 from Section B.
5. Optionally seed the demo dataset (Section I).

### E. Redis setup (Upstash)

1. Create a new Redis database on Upstash.
2. Use the **Redis protocol connection string** (`rediss://...`, TLS), *not* the REST
   API URL — BullMQ/ioredis need a standard Redis-protocol TCP connection, which
   Upstash's regular database provides alongside its REST API. Set as `REDIS_URL` on
   both the api and worker Render services (same value for both — they must point at
   the same Redis instance since BullMQ producer/consumer share queues through it).
3. Be aware of Upstash's free-tier connection-count and command-count limits — this
   deployment opens 2–3 separate persistent Redis connections (api's own + BullMQ
   producer on the api side, BullMQ producer+consumer on the worker side). Not
   guaranteed to fit every free-tier plan indefinitely; check Upstash's current limits
   before relying on the free tier for anything beyond a demo.

### F. Environment variables (exact, per service, as read by the code)

**`apps/api`** (Render):

| Variable | Required? | Notes |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto-set by Render | No action needed — the api reads `PORT` first (Finding #3, fixed); don't override unless you have a specific reason to |
| `DATABASE_URL` | Yes | Supabase/Neon **direct** connection string, `sslmode=require` |
| `REDIS_URL` | Yes | Upstash `rediss://` connection string |
| `WEB_ORIGIN` | Yes | Exact Vercel production URL (Section G) |
| `JWT_SECRET` | Yes | Real random value — `openssl rand -base64 32`. App refuses to boot without one in production. |
| `COOKIE_SECRET` | Yes | Real random value, distinct from `JWT_SECRET` |
| `JWT_REFRESH_SECRET` | Recommended | Not yet consumed by any code (see `configuration.ts`'s comment), but set a real value anyway for forward-compatibility |
| `MOCK_GOOGLE` | Yes | `true` |
| `MOCK_AI` | Yes | `true` |
| `MOCK_DATA` | Optional | `true` to allow seeding; `false` in a real deployment with real data to avoid accidentally seeding demo leads into it |
| `AI_MODE` | Optional | `mock` (redundant with `MOCK_AI=true`, harmless to also set) |
| `GOOGLE_MAPS_ENABLED` | Optional | `false` (default) |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `EMAIL_VERIFICATION_TTL_HOURS`, `PASSWORD_RESET_TTL_MINUTES`, `INVITATION_TTL_DAYS` | Optional | Sensible defaults already in code; only set to override |
| `GOOGLE_MAPS_API_KEY`, `AI_API_KEY`, `AI_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | No | Only needed once `MOCK_GOOGLE=false`/`MOCK_AI=false` |

**`apps/worker`** (Render):

| Variable | Required? | Notes |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `DATABASE_URL` | Yes | Same value as api's |
| `REDIS_URL` | Yes | Same value as api's (must be the identical Redis instance) |
| `WORKER_HEALTH_PORT` | Only if deployed as Web Service | Same `PORT`-matching consideration as Finding #3 |
| `GOOGLE_MAPS_API_KEY` | No | Only relevant if a Search's `providerMode` is `GOOGLE` |
| `MAX_CONCURRENT_REQUESTS`, `GOOGLE_REQUEST_RATE_LIMIT`, `MAX_PAGES`, `MAX_RESPONSE_SIZE`, `REQUEST_TIMEOUT`, `CRAWLER_REQUEST_DELAY_MS` | Optional | Sensible defaults already in code |

**`apps/web`** (Vercel):

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Exact Render api URL, e.g. `https://leadradar-api.onrender.com` |
| `API_URL` | Optional | Only needed if the Next.js server should reach the api by a different address than the public one; set equal to `NEXT_PUBLIC_API_URL` for this deployment |

### G. CORS configuration

Set `WEB_ORIGIN` on the api service to the **exact** Vercel production URL, including
scheme, no trailing slash — e.g. `https://leadradar.vercel.app` or your custom domain.
This must be updated any time the production frontend URL changes (custom domain added
later, etc.) — `apps/api/src/main.ts` reads it once at boot, so a change requires a
redeploy/restart of the api service, not just an env var edit.

### H. Prisma migration commands

Run once against the production database before (or, with Docker Option 1, automatically
as part of) first boot:

```bash
# From the repo root, with DATABASE_URL pointed at the production database
pnpm --filter api exec prisma migrate deploy
```

This applies all 7 existing migrations non-interactively. **Never** run
`prisma migrate dev` against production (it can prompt interactively and is meant for
local schema iteration, not deployment). If using Docker Option 1 for the api, this
happens automatically on every container start via the Dockerfile's `CMD` — no manual
step needed, though running it manually once before first traffic is a reasonable extra
safety check.

### I. Seed commands

Optional — only if you want the demo dataset live in the deployed database:

```bash
# From the repo root, with DATABASE_URL pointed at the production database
pnpm --filter api run db:seed
```

Creates one organization ("Demo Agency"), login `demo@leadradar.app` / `demo12345`, 200
leads. Gated by `MOCK_DATA` — skips entirely if `MOCK_DATA=false`. Safe to run once; **not**
idempotent (re-running against a database that already has this demo org will fail on
the unique email/slug constraints, not silently duplicate) — see the comment at the top
of `apps/api/prisma/seed.ts`.

### J. Health-check endpoints

| Service | Path | Port var | Checks |
|---|---|---|---|
| api | `GET /health` and `GET /ready` (identical) | `PORT`/`API_PORT` | Postgres, Redis, reports active `MOCK_*` flags |
| worker | `GET /health` | `WORKER_HEALTH_PORT` | Redis |
| web | `GET /api/health` | Vercel-managed | Liveness only (`status: "ok"`, no dependency checks) |

Use `/health` for Render's Health Check Path field on both api and worker (if worker is
deployed as a Web Service).

### K. Production test checklist

Run manually against the live deployment before calling it done:

1. `curl https://<api-domain>/health` → `200`, `"status":"ok"`, `checks.database.status:"ok"`, `checks.redis.status:"ok"`
2. `curl https://<worker-domain>/health` → `200`, `"status":"ok"` (if worker's health endpoint is externally reachable)
3. Visit `https://<web-domain>/` → landing page loads, no console errors
4. Register a new account → confirm the session cookie is actually set (DevTools →
   Application → Cookies, check `SameSite`/`Secure` values match Finding #1's fix) and
   the user lands on `/app` without being redirected back to `/login`
5. Reload `/app` → session persists (proves the cookie round-trips correctly cross-domain)
6. Run a search (`/app/find`) → mock results return
7. Save a lead, open its audit page, run enrichment → real BullMQ job completes (proves
   worker ↔ Redis ↔ Postgres all connected correctly across the three separate services)
8. Generate an AI insight and an outreach message → mock content renders
9. Move a lead through the pipeline, add a note/tag/follow-up
10. View `/app/analytics` → real numbers, not zeros-only unless genuinely empty
11. Visit `https://<api-domain>/api/docs` → Swagger UI loads
12. Check Render logs for both services — no repeating error loops, no crash-restart cycles
13. Confirm rate limiting behaves per-IP, not globally-shared (Finding #4) — two
    different browsers/networks should each get their own quota, not share one

### L. Exact deployment order

1. **Database first:** create the Supabase/Neon project, get the direct connection
   string.
2. **Redis second:** create the Upstash database, get the `rediss://` connection string.
3. **Apply migrations** against the new database (Section H) — before any app tries to
   connect, so the schema exists.
4. **Deploy the api** (Render) with all env vars from Section F set, including the two
   real secrets (`JWT_SECRET`, `COOKIE_SECRET`) — `WEB_ORIGIN` can initially point at a
   placeholder/localhost value since the frontend doesn't exist yet; you'll update it in
   step 6.
5. **Deploy the worker** (Render), same `DATABASE_URL`/`REDIS_URL` as the api.
6. **Deploy the frontend** (Vercel) with `NEXT_PUBLIC_API_URL` pointed at the api's real
   Render URL from step 4.
7. **Update `WEB_ORIGIN`** on the api service (Render) to the real Vercel URL from step
   6, then redeploy/restart the api so the new CORS origin takes effect.
8. **Seed the demo dataset** (Section I), optional.
9. **Run the production test checklist** (Section K) end to end.
10. Only after step 9 passes: point a custom domain at either service, if desired.

---

## Status

Findings 1–4 are fixed in code, with tests, as described in Part 2. Finding 5 was
evaluated and intentionally left unchanged. Finding 6 is documented above, not a code
change. See the repository's own change log / commit history for exactly what was
touched. Real `docker build`/deployment to Vercel/Render has not been performed — this
machine cannot run Docker (no hardware virtualization) and no deployment was requested
yet; see the relevant validation section for how the Docker-build-equivalent steps were
verified instead.
