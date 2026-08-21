# Security review

A point-in-time review of LeadRadar's security posture, done as part of preparing the
project for deployment (2026-08-21). Each section below is: what was checked, what was
found, and what changed as a result. Nothing here is a substitute for a real third-party
pentest before handling real customer data — see [Known limitations](#known-limitations).

## Authentication & sessions

- Passwords hashed with **argon2** (`@node-rs/argon2`), never stored or logged in plain
  text.
- Access tokens are short-lived JWTs (default 15 min); refresh tokens are **opaque,
  high-entropy random values**, not JWTs — hashed (SHA-256) before being stored, so a
  database read alone never yields a usable session token. Refresh sessions are
  rotated on every use (old token hash marked `replacedByTokenHash`, reuse of a
  rotated-out token is detectable).
- Both tokens are delivered as `httpOnly`, `SameSite=Lax` cookies — never readable by
  client-side JavaScript, and never returned in a JSON response body. The refresh
  cookie is scoped to `/auth` only, so it isn't attached to every API request.
- `secure: true` on cookies whenever `NODE_ENV=production` — real deployments (Vercel,
  Render, Fly, etc.) terminate TLS in front of the app, so this is correct there; it's
  also why the local Docker Compose "full" profile (which also sets
  `NODE_ENV=production` to test the real build) needs a bit more setup than plain
  `pnpm dev` — see [deployment.md](./deployment.md).
- **Startup guard**: the API refuses to boot with `NODE_ENV=production` if
  `COOKIE_SECRET`/`JWT_SECRET` are empty, equal to each other, or still the
  `dev-insecure-*` placeholder values from `.env.example` (`apps/api/src/main.ts`).
  This turns "forgot to set a real secret in prod" from a silent vulnerability into a
  boot-time crash with an actionable message.
- `JWT_REFRESH_SECRET` is present in the env var surface (and included in
  `.env.example`) but **not yet consumed by anything** — refresh tokens are opaque
  values with a plain (unkeyed) SHA-256 hash, so there's nothing to key. It's reserved
  for a possible future HMAC-peppered hash; documenting this explicitly rather than
  wiring it in for its own sake, since an unused "security" knob that does nothing is
  worse than no knob at all.

## Authorization & organization isolation

- Every organization-scoped write/read goes through `OrgGuard` (resolves the caller's
  membership for the target org) and, where role matters, `RolesGuard` +
  `@Roles(...)` (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`). VIEWER is excluded from every
  mutating CRM/campaign/audit-log endpoint.
- Every Prisma query that touches org-scoped data filters by `organizationId` pulled
  from the *authenticated membership*, never from a client-supplied field — a request
  for another org's lead/campaign/audit-log by ID resolves to "not found," not a
  cross-tenant leak. Verified by the e2e suite's org-isolation tests across every
  module (crm, campaigns, analytics, audit-log, digital-intelligence).
- Personal-account events (login, password change, etc.) are deliberately excluded
  from the org-scoped audit log endpoint (`GET /audit-logs`) — they have no
  `organizationId` (a user can belong to multiple orgs, and login predates org
  context) — and are instead served from a separate self-scoped endpoint
  (`GET /auth/audit-log`) that needs no role gate since it's always the caller's own
  data.

## CORS

- `app.enableCors({ origin: WEB_ORIGIN, credentials: true })` — a single, explicit
  allowed origin (not a wildcard, not a reflected-origin regex), read from config.
  Credentialed cross-origin requests (the only kind that matter here, since auth is
  cookie-based) are rejected from anywhere else.

## Rate limiting

- Global default: 100 requests/minute per IP (`ThrottlerModule`), bumped to
  10,000/min under `NODE_ENV=test` so the e2e suite's hundreds of requests-per-run
  don't self-throttle.
- Tighter per-endpoint throttles on the expensive/abuse-prone routes: search
  (`SEARCH_THROTTLE`), AI generation (`AI_GENERATE_THROTTLE`), and similar — these
  exist independently of the global default because a search or AI call costs real
  compute (and, in non-mock mode, real money) per request in a way a `GET /leads`
  doesn't.

## Input validation

- Global `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted:
  true })` — every request body is validated against its DTO's `class-validator`
  decorators; unknown fields are rejected outright rather than silently dropped or
  passed through.

## SQL injection

- All database access goes through Prisma's query builder (parameterized under the
  hood) — no raw string-interpolated SQL anywhere in the codebase. The one raw query
  in the app (`health`'s `SELECT 1` liveness check) is a fixed literal with no
  interpolated input.

## XSS

- No `dangerouslySetInnerHTML`, no `eval`/`new Function` anywhere in `apps/web`.
  User-generated content (business names, notes, outreach message bodies) renders
  through normal JSX, which escapes by default.

## CSRF

- State-changing requests require the session cookie, which is `SameSite=Lax` — a
  cross-site `<form>` POST won't carry it on most browsers' default handling of
  same-site navigation-triggered requests, and a cross-site `fetch`/XHR won't carry it
  at all under `SameSite=Lax` unless the request is a top-level navigation. Combined
  with the explicit single-origin CORS policy (which blocks a malicious origin's
  script from reading any response even if it could send the request), this covers
  the common CSRF paths for this app's shape (a JSON API with no state-changing GET
  endpoints). No separate CSRF token is issued — `SameSite=Lax` + strict CORS is the
  chosen mitigation, not an oversight.

## Secrets handling

- No `.env` file is tracked in git (verified via `git ls-files`); `.gitignore`
  excludes `.env`, `.env.local`, `.env.*.local` and explicitly keeps `.env.example`
  files trackable.
- Every `.env.example` uses placeholder values, never a real credential.
- Structured logs (`nestjs-pino`) redact `req.headers.authorization`,
  `req.headers.cookie`, `res.headers["set-cookie"]`, and any `password`/
  `currentPassword`/`newPassword`/`token`/`accessToken`/`refreshToken` field in a
  logged object — so a stray `logger.log(someDto)` can't leak a credential into log
  output even if the redaction paths aren't hit exactly, since Nest's request logger
  is the one place a raw request/response actually gets serialized wholesale.

## Logging & observability

- The API uses `nestjs-pino` for structured logging (JSON in production, pretty-printed
  in development, silenced under `NODE_ENV=test`) — matching the pattern
  `apps/worker` already used. Every request is logged with method/path/status/timing;
  see the redaction list above for what's deliberately excluded.

## API key handling (Google Maps / AI providers)

See [Google API review](#google-api-review) and [AI review](#ai-review) below — the
short version is both keys are server-side only and never reach the browser.

## SSRF — the website crawler

**This was the highest-severity finding in this review, and the fix is the most
substantial change in this pass.** LeadRadar's lead-enrichment pipeline fetches a
lead's own website (`packages/providers/src/website-crawler`) to extract contact info
and audit its digital presence. That `startUrl` ultimately comes from Google Places
data (in `GOOGLE` mode) — which is business-supplied content on Google's side, not
something LeadRadar controls — so a malicious or simply mistaken business listing
could point it at an internal address.

**Found during this review:** the crawler's HTTP layer (`fetch-with-limits.ts`) had a
request timeout and a response-size cap, but **no check at all on the destination
address** — `http://127.0.0.1:6379/`, `http://169.254.169.254/latest/meta-data/`, or
any RFC1918 address would be fetched exactly like a public site. Confirmed live: an
early version of the fix's own test suite accidentally connected to this machine's
real local Redis over `http://127.0.0.1:6379/` (visible in the response — a
non-HTTP protocol reply from a real service) before the fix landed.

**Fix** (`packages/providers/src/website-crawler/url-safety.ts`):

- A synchronous pre-check (`isBlockedHostname`) rejects `localhost`, `*.local`,
  `*.internal`, and any literal IP address (v4 or v6) that's loopback, link-local
  (including the `169.254.169.254` cloud metadata address every major cloud provider
  uses), RFC1918/CGNAT private ranges, or otherwise reserved — **before any network
  call is attempted**. This exists as a separate check from the one below because
  Node's connector skips calling a custom `dns.lookup` entirely when the host is
  already a numeric IP literal (confirmed empirically, not assumed) — so IP-literal
  URLs need their own guard.
- A custom `dns.lookup` (`createSafeLookup`), wired into a per-request undici `Agent`
  via `connect.lookup`, re-validates the *actual resolved address* immediately before
  each socket connects — covering hostname-based DNS rebinding (a domain that
  resolves to a public IP on an earlier lookup but a private one at connect time),
  since there is no earlier, separately-timed lookup for an attacker to race against.
  This function also enforces a redirect cap: it refuses to validate more than
  `maxRedirects + 1` connections per outbound `fetchWithLimits` call (each
  cross-origin redirect hop needs a fresh connection, and therefore a fresh `lookup`
  call — same-origin redirects reuse the pooled connection and don't count, which is
  fine since they can't be used for SSRF).
- Response size (`maxResponseBytes`, aborts the stream early) and request timeout
  (`timeoutMs`) were already enforced and are unchanged.
- Page count is bounded by `crawler.ts`'s own `maxPages` loop (default 5) and never
  follows links found on anything but the homepage (bounded breadth, not a general
  crawler) — unchanged, already correct.
- `robots.txt` is fetched and respected (`isPathAllowed`) — unchanged.

37 new unit tests cover both the synchronous IP-literal/hostname pre-check and the
DNS-time lookup guard directly (`url-safety.spec.ts`), plus integration-style
assertions in `fetch-with-limits.spec.ts` that these are actually wired into the real
request path, not just present as unused utility functions.

**Residual risk, documented rather than hidden:** the DNS-rebinding protection closes
the TOCTOU window between an app-level lookup and the actual connect, but a
sufficiently fast DNS-rebinding attack that changes records *during* an in-progress
multi-page crawl (rather than between separate `fetchWithLimits` calls) is a
theoretical edge case not specifically tested here. Each of the up-to-5 page fetches
per crawl does get its own fresh Agent/lookup validation, which is the practical
mitigation for that case too — but this hasn't been adversarially tested against a
real DNS-rebinding rig.

## Known limitations

This review was done by reading the code and writing/running targeted tests — it is
**not** a substitute for:

- A real penetration test before handling real user data at scale.
- Dependency vulnerability scanning as an ongoing, automated practice (not run as part
  of this review — consider adding `pnpm audit` or a Dependabot/Snyk integration to
  CI).
- A review of the hosting platform's own security posture (Vercel/Render/Supabase/
  Neon/Upstash) — this document covers the application's code, not its infrastructure.
- Load-testing the rate limiter's actual effectiveness under a real distributed attack
  (a single global IP-based limiter is a reasonable baseline, not a complete defense
  against a botnet).

## Google API review

- The Google Maps Platform API key is read from a server-side-only env var
  (`GOOGLE_MAPS_API_KEY`, aliased from the original `GOOGLE_PLACES_API_KEY`) and only
  ever touched by `apps/api`/`apps/worker` — it is never sent to the browser, never
  present in any `NEXT_PUBLIC_*` variable, and never appears in a client-side bundle
  (verified: `apps/web`'s env vars are limited to `NEXT_PUBLIC_API_URL`/`API_URL`,
  neither of which is a Google key).
- Uses the official **Places API (New)** REST endpoints only (`fetch` with
  `X-Goog-Api-Key`/`X-Goog-FieldMask` headers) — no Maps JavaScript SDK loaded with a
  scrapeable key, no headless-browser automation of the Google Maps website, no
  CAPTCHA bypass of any kind.
- Every request sends an explicit, minimal field mask (`SEARCH_FIELD_MASK`/
  `DETAILS_FIELD_MASK` in `google-places.provider.ts`) — only the fields the app
  actually uses (name, address, location, rating, review count, status, website,
  phone, category, Maps URI, and for details: opening hours/types/photo presence).
  This is both a cost control (Places API bills per field tier) and a data-minimization
  choice — the app never requests fields it has no use for.
- Attribution: every business record's `googleMapsUri` (the canonical Google Maps
  link Google's own API returns) is surfaced and linked in the Find results, the map
  view, and the result detail sheet — so Google-sourced data always carries a visible,
  clickable link back to its source.
- **Provider abstraction**: `GooglePlacesProvider` implements the same
  `LeadDiscoveryProvider` interface as `MockLeadDiscoveryProvider`; which one is used
  is decided entirely by config (`MOCK_GOOGLE`/`GOOGLE_MAPS_ENABLED`/
  `GOOGLE_MAPS_API_KEY`), never by call-site branching. **Mock mode needs zero Google
  credentials and is fully functional** — this is the default, and is what the demo
  dataset (`pnpm db:seed`) and CI both run against.

## AI review

- The AI provider only ever receives a `LeadIntelligenceContext` built from verified
  LeadRadar data (crawled website signals, Google Business signals, computed audit
  scores) — see `@lead-radar/types`. That type has **no field** for revenue,
  employee count, customer count, business history, technology spend, or any other
  fact the app hasn't actually observed — so the AI provider is structurally unable to
  receive (and therefore invent) those facts; this isn't a prompt instruction that
  could be ignored, it's the absence of a field to invent from.
- Every system prompt sent to the local/external providers additionally instructs the
  model never to claim a problem that wasn't detected in the supplied signals, as a
  second layer on top of the structural one.
- **Recommended Services** (the specific service upsells shown to the user) are never
  AI-generated at all — they're a deterministic, rule-based mapping over detected
  `GrowthOpportunity` findings (`recommended-services.ts`), so that part of the output
  has zero hallucination surface by construction.
- AI generation is always **user-triggered** (a "Generate message"/"Generate insight"
  click) — nothing calls an AI provider automatically or in a background job. Costed
  usage is also logged per call (`AIUsageEvent`, including cache hits) for auditability.
- **Mock and local modes both work with zero external accounts.** `MOCK_AI=true`
  (the default) uses deterministic, template-based generation over the same verified
  data — no network call at all. `AI_MODE=local` uses a locally-running Ollama
  instance — real generation, zero cost, nothing leaves the machine. `EXTERNAL` mode
  (a real hosted AI API) is opt-in only and falls back to mock automatically if
  `AI_API_KEY` is unset.
