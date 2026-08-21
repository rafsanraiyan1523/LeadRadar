# Development roadmap

## Phase 0 — Foundation (this phase)

- [x] Monorepo (pnpm workspaces): `apps/{web,api,worker}`, `packages/{ui,config,types,eslint-config}`
- [x] Next.js (App Router, TS, Tailwind v4, shadcn/ui, neutral palette + brand accent)
- [x] NestJS (config, global pipes/middleware, Prisma, Redis wiring)
- [x] PostgreSQL + Prisma (schema, client generation, migration scripts)
- [x] Redis + BullMQ (worker connection, queue/worker factory helpers)
- [x] Shared TypeScript config, ESLint (flat config), Prettier
- [x] Environment configuration (`.env.example` per app + root)
- [x] Docker Compose (infra-only by default, full containerized stack via `full` profile)
- [x] Health endpoints on all three services, verified end-to-end via the homepage status card
- [x] README, architecture doc, this roadmap

**Explicitly not done yet:** auth, any domain model beyond a placeholder `HealthCheck` table,
any of the marketing/app routes beyond `/`, lead discovery, scoring, AI, CRM. Building those
before the foundation was solid would mean re-doing them once real config/DB/queue patterns
were established.

## Phase 1 — Auth & tenancy ✅

- [x] `users`, `organizations`, `organization_members`, `invitations` tables + full auth schema
      (`refresh_sessions`, `email_verification_tokens`, `password_reset_tokens`) — 26 models total,
      covering every module through campaigns/analytics so later phases are additive migrations only.
- [x] Cookie-based session auth: argon2id hashing, short-lived JWT access token + rotating opaque
      refresh token (with reuse-detection — replaying a rotated token revokes the whole session
      family), httpOnly/secure/sameSite cookies, no tokens in localStorage.
- [x] Register, login, logout, `/auth/me`, refresh, forgot/reset password, email verification
      (confirm + resend), change password, session listing/revocation.
- [x] Multi-tenant authorization: `OrgGuard` resolves the acting organization from membership (not
      a client-supplied id) and `RolesGuard` + `@Roles()` gate owner/admin-only actions — the actual
      enforcement boundary for "a user must never access another org's leads."
- [x] Organizations module: list my orgs, invite (role-gated, last-owner-protected), accept
      invite, list/update/remove members.
- [x] Security: DTO validation (`whitelist`+`forbidNonWhitelisted`), throttling (global +
      stricter on auth endpoints), helmet, CORS locked to `WEB_ORIGIN`, structured JSON error
      responses via a global exception filter.
- [x] `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, and the
      `/app` authenticated shell (sidebar, topbar, user menu, notifications bell, mobile nav sheet,
      dark mode via next-themes).
- [x] Tests: 22 unit tests (hashing, tokens, guards) + 42 e2e tests against a real embedded
      Postgres (registration, login, logout, protected routes, org isolation, role permissions,
      session refresh/reuse-detection, invalid credentials) — all passing.

**Not done:** a dedicated `settings` page (stubbed as "coming soon" — the API surface it would
need, like updating profile/org name, doesn't exist yet either).

## Phase 2 — Lead discovery & enrichment ✅

- [x] `LeadDiscoveryProvider` interface in `@lead-radar/providers`; `MockLeadDiscoveryProvider`
      (deterministic, realistic Dhaka-area businesses — real coordinates, Bangladeshi phone formats,
      varied Google-presence/website/rating signals) is the default. `GooglePlacesProvider` is fully
      implemented against the real Places API (New) — minimal field masks, concurrency + rate
      limiting, request timeouts — but only activates when `GOOGLE_PLACES_API_KEY` is configured.
- [x] `lead-discovery` module (api) + BullMQ `lead-discovery` queue processed in `worker`:
      create Search → enqueue → provider → normalize → persist `SearchResult` rows → progress
      updates the UI polls. Handles provider failure, queue-enqueue failure, and empty results as
      first-class outcomes (not just the happy path).
- [x] Search history (`GET /searches`) with query/location/filters/date/result-count/provider-mode,
      reopenable from `/app/find`.
- [x] `/app/find`: search form, filters (rating/reviews/website/Google presence/opportunity
      heuristic/low-reviews/weak-presence), split list+map layout, sort, "Load more" pagination,
      multi-select + bulk save, per-card save/view/open-maps, recent searches.
- [x] Bulk-save promotes `SearchResult` rows into real `Lead` records (org-scoped, activity-logged).
- [x] Tests: 18 unit tests (mock provider realism, Google provider incl. timeout/failure/404,
      rate limiter, concurrency limiter) + 6 worker unit tests (processor: success, provider
      failure, timeout, empty result) + 11 e2e tests (validation, org isolation, queue failure,
      bulk save) — all passing. Verified once more end-to-end with a full-stack smoke test
      (real Postgres + Redis + all three services + a real browser driving register → search →
      results) — see the session notes for the two real bugs that surfaced only under that
      production-mode run (shared-package `main` fields pointing at raw `.ts`, and a frontend/backend
      filter-shape mismatch).

- [x] Lead Enrichment Engine: bounded `website-crawler` provider (cheerio-based, `MAX_PAGES=5`,
      response-size + request-timeout limits, robots.txt-respecting, rate-limited between
      requests) crawls a lead's own homepage plus contact/about/services/booking pages — never
      the whole site, never third-party platforms. Extracts public emails/phones, booking/contact
      URLs, contact-CTA presence, title/meta description/H1/headings/canonical/robots/sitemap,
      Open Graph, structured data, HTTPS, viewport, tech-stack fingerprints, and basic
      accessibility signals (alt text, lang attribute, heading hierarchy, viewport meta) — never
      fabricated, always "Not found" when a signal genuinely isn't present.
- [x] Social detection: Facebook/Instagram/LinkedIn/YouTube/TikTok links surfaced only when
      linked from the business's own site — no feed scraping, no private-profile access.
- [x] Contactability Score (0–100, explainable breakdown: phone/email/website/Facebook/
      Instagram/LinkedIn/booking/contact page/contact CTA) plus SEO and accessibility scores,
      computed as pure functions over the crawl extraction and persisted as a `WebsiteAudit` row
      per run (history, not overwritten).
- [x] `lead-enrichment` BullMQ queue (api enqueues on `POST /leads/:id/enrich`, worker crawls →
      extracts → normalizes → audits → saves → notifies via the existing in-app `Notification`
      model) with `enrichmentStatus`/`enrichmentProgress` tracked on `Lead` and polled by the UI.
      Never overwrites a lead's already-known phone/email — only fills genuine gaps.
- [x] `ContactInfoPanel` (Phone/Email/Website/Booking/Facebook/Instagram/LinkedIn, each with
      Open/Copy/Verified-state/Source) wired into `ResultDetailSheet` for any result already
      promoted to a Lead, with an Enrich/Re-enrich trigger and live progress polling.
- [x] Tests: 71 provider unit tests (email/phone/social extraction, timeout/403/404/redirect/
      invalid-URL/robots handling, contactability/SEO/accessibility scoring) + 5 worker processor
      unit tests (save + gap-fill + notify on success and failure) + 8 e2e tests (validation, org
      isolation, queue-failure recovery, response shape/score) — all passing.

**Not done yet:** `/app/leads` list UI (no first-class leads table page yet — bulk-save and
enrichment are verified via API/tests and the Find sheet, not a dedicated list view), bulk-audit
across multiple leads at once, export.

## Phase 3 — Digital presence analysis (the Digital Intelligence Engine) ✅

- [x] `website-audit` signals (SEO/accessibility/tech-stack fingerprints) and social-channel
      detection shipped early as part of the Phase 2 Lead Enrichment Engine (`website-crawler`
      provider + `WebsiteAudit`/`LeadSocialProfile` models) — see Phase 2 above. Still no
      Lighthouse-style performance scoring (would need a headless browser, out of scope for the
      zero-cost-by-default crawler) — the crawler now does capture basic, self-measured homepage
      response time/size and a bounded broken-link signal, both clearly labeled as LeadRadar
      checks, never a PageSpeed/Lighthouse score.
- [x] `@lead-radar/providers/audit`: pure, unit-tested scoring engines — SEO, mobile, conversion,
      technical, and an overall Website Score (their equal-weighted average); a Google Profile
      Score computed only from a **verified** (`FOUND`) Google Business lookup; the Overall
      Opportunity Score (legitimacy from a verified Google profile + inverse of digital-presence
      weakness — an established business with no website scores high, an excellent digital
      presence scores low); and structured Growth Opportunity findings
      (title/category/severity/evidence/recommendation). Fully documented, with worked examples,
      in [docs/scoring.md](scoring.md).
- [x] `google-business` audit: the worker calls the real `GooglePlacesProvider` for leads with a
      genuine Google Place ID (real-Google-mode leads only), or replays the same deterministic
      mock lookup used at discovery time for mock-mode leads — never fabricates a real place ID
      for a mock lead. Reports `FOUND` / `NOT_FOUND_IN_CURRENT_SEARCH` / `UNVERIFIED`, and only
      ever claims `NOT_FOUND_IN_CURRENT_SEARCH` after a real lookup genuinely came back empty.
- [x] `growth-opportunities` + `opportunity-scoring`: the existing "Enrich" pipeline
      (`lead-enrichment.processor.ts`) now runs the full digital intelligence pass after every
      crawl — website audit, Google Business audit, growth-opportunity generation, and
      opportunity scoring — and persists all of it (`WebsiteAudit` extended with per-category
      scores and a structured `signals` snapshot, `GoogleBusinessProfile`, `GrowthOpportunity`,
      `OpportunityScore`, plus a `lead.audit_completed` activity entry and notification).
- [x] `apps/api/src/digital-intelligence`: `WebsiteAuditService`, `SEOAuditService`,
      `ConversionAuditService`, `GoogleBusinessAuditService`, `OpportunityScoringService`, and
      `GrowthOpportunityService`, aggregated behind `GET /leads/:id/audit` for the lead audit page.
- [x] `/app/leads/[id]`: the full lead audit page — score-ring hero (Opportunity Score/level,
      location, contactability), and Overview/Contact/Google Business/Website/SEO/Conversion/
      Social/Growth Opportunities/AI Insight (stub)/Outreach (stub)/Activity sections, with
      expandable evidence panels and severity-coded findings. Reachable from the Find result
      sheet ("View full digital intelligence audit") for any promoted lead.
- [x] Tests: 27 new provider unit tests across the six audit engines (including the required
      excellent-business/no-website/poor-website/strong-Google-profile/weak-contactability/
      mixed-signals scenarios, plus explicit determinism assertions) + extended worker processor
      tests (Google audit status resolution, score/finding persistence) + a new e2e suite for the
      audit read API (org isolation, pre-audit vs. post-audit response shape) — all passing
      alongside lint/typecheck/build across all three apps.

## Phase 4 — AI insight & outreach ✅

- [x] `AIProvider` interface (`@lead-radar/types/ai`) + three implementations
      (`packages/providers/src/ai`): `MockAIProvider` (templated, deterministic, zero-cost
      default), `LocalAIProvider` (Ollama — truly zero-cost local dev), and `ExternalAIProvider`
      (the real Anthropic API, opt-in, server-side only). `createAIProvider` picks the
      implementation from `AI_MODE`, defaulting to mock whenever local/external lacks its
      required config. Full write-up, including the AI RULE and its enforcement, in
      [docs/ai.md](ai.md).
- [x] Five AI features: Lead Summary, Growth Opportunity Analysis, Recommended Services (a
      deterministic rule-based mapping over detected findings — never AI-generated), Outreach
      Message, and Follow-up Message (referencing a real, on-file prior message, never
      client-supplied text).
- [x] `apps/api/src/ai`: `AiService` builds `LeadIntelligenceContext` from the Digital
      Intelligence Engine's already-verified data, caches the Lead Summary/Growth
      Analysis/Recommended Services per lead (fingerprinted by an inputs hash — AI COST CONTROL),
      and persists every outreach/follow-up generation as a new `OutreachMessage` row (history
      kept, Regenerate never overwrites). Every AI call, including cache hits, is logged to
      `AIUsageEvent`. `AiController` exposes `GET/POST /leads/:id/insight`, `POST
      /leads/:id/outreach/generate`, `POST /leads/:id/outreach/follow-up`, and `PATCH
      /leads/:id/outreach/:messageId` (edit / mark sent), all throttled and org-scoped.
- [x] Outreach UX on the lead audit page: channel (Email/WhatsApp/Facebook/LinkedIn/SMS), tone
      (Professional/Friendly/Consultative/Short), and language (English/Bangla/Banglish)
      selectors; generated message with Edit/Copy/Regenerate/character count; Open
      Email/WhatsApp/Facebook/Website built client-side from the lead's own verified contact
      channels. No automated or bulk messaging — every send stays a manual, user-initiated action.
- [x] Tests: 54 new provider unit tests (mock/local/external providers, prompt construction
      including forbidden-claim coverage, `parseGeneratedMessage`, recommended-services mapping,
      provider-selection fallback) + a new e2e suite (org isolation, insight caching verified via
      real `AIUsageEvent` rows, outreach DTO validation, Bangla-script generation verified against
      a real Postgres row, follow-up-references-a-real-message, edit/mark-sent) — all passing
      alongside lint/typecheck/build across all three apps. Also fixed a real latent bug this
      work surfaced: the zero-Docker Windows e2e Postgres was defaulting to a non-UTF8 encoding
      that silently couldn't store Bangla text (see docs/ai.md).

## Phase 5 — CRM ✅

- [x] `crm` module (`apps/api/src/crm`: `CrmService`/`CrmController`/`LeadCrmController`): pipeline
      stages, lead status transitions (`PATCH /leads/:id/status`, logs a `lead.status_changed`
      activity), org-wide lead list + filters (score/status/category/location/website/Google
      profile/contactability), per-user saved-lead bookmarks (`SavedLead`, distinct from the
      org-wide list), private notes and client-loggable activities (message copied, channel
      opened) stored as `LeadActivity` rows, tags (preset chips + custom, `Tag`/`LeadTag`,
      find-or-create by name), and follow-ups (`FollowUp`, due date + note, a real BullMQ-delayed
      `follow-up-reminder` queue/processor in the worker that notifies at `dueAt` and re-checks
      the follow-up is still PENDING first). No new Prisma models or migration needed — the
      Phase-1 schema already had `Tag`/`LeadTag`/`FollowUp`/`SavedLead`/`Notification`/
      `LeadActivity`. Write endpoints are role-gated to OWNER/ADMIN/MEMBER (VIEWER is read-only).
- [x] `/app/pipeline`: Kanban board (`@dnd-kit/core`), 8 columns (New/Contacted/Replied/
      Interested/Meeting/Proposal/Won/Lost — "New" absorbs both the `NEW` and `SAVED`
      `LeadStatus` values, since every lead enters the CRM already `SAVED`), optimistic
      drag-and-drop status updates with TanStack Query rollback on API failure, a shared
      `LeadDetailSheet` (status/tags/notes/follow-ups/activity) opened from any card.
- [x] `/app/leads` (replacing the old "coming soon" stub) and `/app/saved`: filterable grid views
      over the same `LeadCardView` shape as the pipeline, sharing `LeadListView`/
      `LeadsFilterBar`/`LeadCardContent`.
- [x] `/app/searches` (new route): paginated search history (query/location/filters/date/results),
      reachable from the sidebar nav.
- [x] Tests: 18 new e2e tests (`crm.e2e-spec.ts` — status change/persistence, pipeline org
      isolation, filters, save/unsave, notes, tags incl. idempotent re-attach, follow-ups incl.
      reminder-job scheduling, client-loggable-activity whitelist, org isolation, VIEWER
      permissions) + 5 new worker unit tests (`follow-up-reminder.processor.spec.ts`) — all
      passing alongside the existing 81 e2e / 22 api-unit / 13 worker-unit tests. Verified live
      end-to-end with a real browser (Playwright/Chromium) driving register → search → save →
      drag a pipeline card → reload → status persisted → notes/tags/follow-ups all functional,
      zero console errors.

(Campaigns were sequenced into Phase 6 below, alongside analytics, since both needed the same
`Lead`-aggregation groundwork.)

## Phase 6 — BI dashboard, analytics & campaigns ✅

- [x] `analytics` module (`apps/api/src/analytics`): `GET /dashboard` (unfiltered snapshot: 8
      header metrics, 8 charts, Recent Leads, Top Opportunities) and `GET /analytics`
      (date/category/location/status/score-filtered, same metrics/charts shape) — every figure
      computed live via `Lead.groupBy`/aggregation, nothing hardcoded or cached. Metrics use flat
      per-status counts; the Pipeline Funnel chart separately uses a cumulative
      "reached-at-least-this-stage" ordinal (LOST broken out as its own bar, never assumed to have
      passed through earlier stages it may not have reached).
- [x] `/app` dashboard (replacing the previously-missing root page) and `/app/analytics`
      (Recharts, `dataviz`-skill-compliant: validated categorical palette for status bars — see
      `chart-colors.ts` — thin rounded bars, hairline gridlines, hover tooltips, no dual axes).
      Recent Leads table + Top Opportunities panel (rule-based key-problem/recommended-service,
      reusing the existing `mapFindingsToRecommendedServices`) round out the dashboard.
- [x] `campaigns` module (`apps/api/src/campaigns`) + `/app/campaigns` + `/app/campaigns/[id]`:
      create with a lead picker, target category/location, service/tone/channel; per-campaign
      dashboard (leads/messages-generated/contacted/replied/meetings/won/conversion-rate); bulk
      "Generate messages" creates DRAFT `OutreachMessage` rows tagged with `campaignId` via the
      existing `AiService` — never auto-sends (same manual-send model as Phase 4). One additive
      migration (`20260821140000_campaigns_and_analytics`).
- [x] CSV export (`GET /leads/export`, in the `crm` module): explicit application-owned-fields
      allow-list, deliberately excluding every Google-Places-sourced column (rating, reviewCount,
      googlePlaceId, googleMapsUri, businessStatus) — reachable from `/app/leads`, `/app/analytics`,
      and the dashboard's Recent Leads card, all respecting the current filters.
- [x] Tests: 20 new e2e (`campaigns.e2e-spec.ts`, `analytics.e2e-spec.ts`) — all passing alongside
      the existing 81 (101 total e2e / 22 api-unit / 18 worker-unit). Verified live in a real
      browser: empty and seeded dashboards in light+dark mode, analytics filtering, full campaign
      lifecycle including message generation, CSV export — zero console errors.

- [x] `audit-log` module (`apps/api/src/audit-log`): every security-relevant auth/org action
      (login, logout, password change/reset, email verification, session revocation, invitation
      created/accepted, member role changed/removed) writes an `AuditLog` row via
      `AuditLogService.record` — fire-and-log, never fire-and-fail. Two read views: `GET
      /audit-logs` (org-scoped, OWNER/ADMIN only, for events with an `organizationId`) and `GET
      /auth/audit-log` (self-scoped, for personal-account events like login that predate/span org
      membership). Surfaced in `/app/settings` as "My activity" / "Organization activity" tabs.
      Tests: 9 new e2e (`audit-log.e2e-spec.ts`) — 110 total e2e / 22 api-unit / 18 worker-unit,
      all passing.
- [x] Playwright e2e coverage of the golden path (`apps/web/e2e/golden-path.spec.ts`): register →
      search → save → score (real BullMQ enrichment job) → outreach (AI message generation) →
      pipeline (drag-equivalent status change + persistence-after-reload), driven against the real
      dev stack via a real browser, not a mocked fetch layer.
- [x] Production hardening: structured JSON logging for the API (`nestjs-pino`, matching the
      worker's existing `pino` setup) with auth/session fields redacted from request logs; a
      bootstrap guard that refuses to start in `NODE_ENV=production` if `COOKIE_SECRET`/
      `JWT_SECRET` are still the dev-insecure defaults or identical to each other. Rate limiting
      was already in place (Phase 1); secrets review confirmed no real `.env` files are tracked in
      git and every `.env.example` uses placeholder values.
- [ ] Not built yet: `/features`/`/pricing` marketing pages.

## Phase 7 — Deployment prep ✅

- [x] **Canonical env var names**: `MOCK_GOOGLE`/`MOCK_AI`/`MOCK_DATA` (umbrella demo-mode
      flags), `GOOGLE_MAPS_API_KEY`/`GOOGLE_MAPS_ENABLED`, `AI_API_KEY`/`AI_MODEL`,
      `JWT_REFRESH_SECRET` — all new, all backward-compatible aliases layered onto the existing
      config (`configuration.ts`), never a breaking rename. `.env.example` (root + per-app)
      rewritten around the new names.
- [x] **Demo dataset**: `apps/api/prisma/seed.ts` — one organization, 200 leads across 10
      categories × 8 Dhaka locations, ~75% fully audited (website/SEO/mobile/conversion/
      technical/accessibility scores, Google Business profile, growth opportunities, contacts,
      social profiles) and ~25% left un-audited for contrast, AI insights + outreach messages for
      engaged leads, notes/tags/follow-ups/saved bookmarks, 6 searches with result history, 3
      campaigns. Deterministic (seeded PRNG). Gated by `MOCK_DATA`. Caught and fixed its own bug
      during verification: the SEO/Conversion sections need a full `breakdown` object in
      `WebsiteAudit.signals`, not just a bare score — the UI silently showed "not audited" until
      fixed, found by actually loading a seeded lead's audit page rather than trusting the schema
      alone.
- [x] **`/health` + `/ready`**: intentionally identical (Postgres + Redis + demo-mode flags) — see
      the comment in `health.controller.ts` for why a liveness/readiness split wasn't worth making
      here.
- [x] **Swagger/OpenAPI** at `/api/docs` (`@nestjs/swagger`) — every controller tagged (Auth,
      Search, Leads, Audit, AI & Outreach, CRM, Analytics, Campaigns, Organizations,
      Notifications, Audit Log), cookie-auth scheme documented. Route-level, not exhaustive
      per-DTO-field annotation — a scope decision given the size of this pass, noted honestly
      rather than claimed as complete.
- [x] **CI** (`.github/workflows/ci.yml`): install → lint → typecheck → test → build on every
      push/PR, no auto-deploy step (deployment is via each host's own git integration — see
      docs/deployment.md). Along the way, fixed a real pre-existing gap this surfaced: the root
      `build`/`typecheck`/`lint` scripts didn't build `packages/types`/`packages/providers`/the
      generated Prisma client first, so they'd fail on a genuinely fresh checkout (verified by
      deleting `dist/`/`generated/` and re-running) — the Dockerfiles already worked around this
      manually; now `package.json`'s `build:packages` script is the single reusable fix.
- [x] **SSRF hardening on the website crawler** — the highest-severity finding this phase. The
      crawler had a request timeout and response-size cap but no check on the destination address
      at all; confirmed live that `http://127.0.0.1:6379/` reached this machine's real local
      Redis before the fix. Fixed with a two-layer guard
      (`packages/providers/src/website-crawler/url-safety.ts`): a synchronous pre-check for
      IP-literal/localhost/`.local` hosts (Node's connector skips a custom DNS lookup for literal
      IPs, so this can't be caught DNS-side), plus a custom `dns.lookup` wired into a per-request
      undici `Agent` that validates the actually-resolved address at connect time (closing the
      DNS-rebinding TOCTOU gap) and caps redirect-driven reconnects. 37 new unit tests. Full
      write-up: [docs/security.md](./security.md#ssrf--the-website-crawler).
- [x] **Security/Google/AI review**: auth, cookies, authorization/org isolation, CORS, rate
      limiting, validation, SQL/XSS/CSRF, secrets, logging, Google API usage, AI hallucination
      surface — see [docs/security.md](./security.md). No other critical/high findings beyond the
      SSRF one and a real, fixed hydration-mismatch bug in the theme toggle (unrelated to this
      phase's scope but caught during the same testing pass — see the React
      `useSyncExternalStore` fix in `use-has-mounted.ts`).
- [x] **Docker**: `docker/{web,api,worker}.Dockerfile` + `docker-compose.yml` already existed;
      fixed a real bug where the `full` profile never passed `JWT_SECRET` to the api container at
      all (would have crashed against the new production-secrets startup guard) and switched the
      three app secrets to compose's required-variable syntax rather than an insecure default,
      since this profile runs the real production build (`NODE_ENV=production`) and is held to
      the same standard. The api container now runs `prisma migrate deploy` automatically on
      every start.
- [x] **README rewrite** — the old one was still describing the Phase-0 foundation state (`the
      product itself ... has not been built yet`); replaced with a full product/architecture/
      setup/deployment/security/testing/limitations doc linking out to the deeper `docs/*` files.
- [x] Deployment guide: [docs/deployment.md](./deployment.md) — Vercel (web) + a free-tier Node
      host (api/worker) + Supabase/Neon (Postgres) + Upstash (Redis), with an explicit "these are
      not guaranteed to stay free" section rather than an unqualified cost claim.
- **Known limitation, disclosed rather than hidden**: this machine has no hardware
  virtualization, so Docker itself cannot run here — the Dockerfile/compose changes were
  verified by careful re-reading of the full build chain, not by an actual `docker build`/
  `docker compose up`. Flagged explicitly rather than claimed as tested.

## Sequencing notes

- Each phase's backend module ships with its Prisma schema additions and migration, its BullMQ
  queue (if it has async work), and its frontend route in the same phase — not split across
  phases — so nothing lands half-wired.
- Provider abstractions (discovery, AI, and later notifications) are designed before their first
  concrete implementation, so the mock/local path and the real path are never divergent designs.
