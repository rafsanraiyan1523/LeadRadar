# Scoring — the Digital Intelligence Engine

This document is the transparent, worked-through specification for every score the Digital
Intelligence Engine produces. The goal throughout: **every point on every score traces to a real,
observed signal.** Nothing is estimated, guessed, or fabricated — a signal that wasn't checked is
`null` ("not audited"), never a silent `0`.

The engine's pure scoring logic lives in `packages/providers/src/audit/` (one file per score, unit
tested in the matching `*.spec.ts`). The orchestration that runs a crawl, calls Google Places, and
persists the results lives in `apps/worker/src/jobs/lead-enrichment.processor.ts`, triggered by the
"Enrich" / "Run digital intelligence audit" action. The six services named below are the read
+ write halves of that pipeline: `WebsiteAuditService`, `SEOAuditService`, `ConversionAuditService`,
`GoogleBusinessAuditService`, `OpportunityScoringService`, and `GrowthOpportunityService`
(`apps/api/src/digital-intelligence/`).

## Score glossary

| Score | Range | Meaning |
| --- | --- | --- |
| SEO Score | 0–100 | On-page SEO fundamentals LeadRadar can observe from a crawl |
| Mobile Score | 0–100 | Basic responsive configuration (viewport meta only — not a device lab) |
| Conversion Score | 0–100 | How easy the site makes it to get in touch or book |
| Technical Score | 0–100 | HTTPS, canonical, sitemap, structured data, broken links, tech stack |
| Website Score | 0–100 | Equal-weighted average of SEO + Mobile + Conversion + Technical + Accessibility |
| Google Profile Score | 0–100 or `null` | Quality of a **verified** Google Business profile — `null` unless the profile is confirmed FOUND |
| Contactability Score | 0–100 | How reachable the business is overall (phone/email/website/social/booking), independent of whether any of that lives on a website |
| Overall Opportunity Score | 0–100 | See below — the number the rest of this document exists to justify |

All scores are labeled **LeadRadar checks** in the product UI. None of them are PageSpeed or
Lighthouse scores — LeadRadar never claims to run either.

## SEO Score (`computeSeoAudit`)

| Signal | Points |
| --- | --- |
| `<title>` present | 15 |
| Meta description present | 15 |
| H1 present | 10 |
| Canonical URL present | 10 |
| Viewport meta tag present | 10 |
| Sitemap discovered (via `robots.txt` or a common path) | 10 |
| Structured data (JSON-LD) present | 10 |
| Open Graph tags present | 10 |
| Not explicitly blocked by `robots` (`noindex`) | 10 |

**Total: 100.** Absence of a `robots` meta tag is not itself a problem — it credits the same as an
explicit `index, follow` — so a page with literally nothing else present still scores 10, not 0.

## Mobile Score (`computeMobileAudit`)

| Signal | Points |
| --- | --- |
| Viewport meta tag present at all | 60 |
| Viewport meta tag configured for device width (`width=device-width`) | 40 |

**Total: 100.** This is deliberately narrow — LeadRadar has no device lab or real-browser
rendering, so it checks the one reliable, static signal for "was this page built to be
responsive at all," and no more.

## Conversion Score (`computeConversionAudit`)

| Signal | Points |
| --- | --- |
| Contact call-to-action (a `mailto:`/`tel:` link, or a booking link) | 20 |
| Phone number visible on the crawled pages | 15 |
| Email address visible on the crawled pages | 15 |
| Booking/scheduling link found | 20 |
| Contact page found | 15 |
| Service/offerings pages found | 15 |

**Total: 100.**

## Technical Score (`computeTechnicalAudit`)

| Signal | Points |
| --- | --- |
| HTTPS | 30 |
| Canonical URL present | 15 |
| Sitemap discovered | 15 |
| Structured data present | 15 |
| No broken links detected among the priority pages LeadRadar tried to reach | 15 |
| A recognizable tech stack fingerprint was found | 10 |

**Total: 100.** "Broken link" here means: of the same-origin contact/about/services/booking links
discovered on the homepage, how many failed to load when LeadRadar tried to fetch them (non-2xx,
timeout, network error). This is a bounded, basic signal — not a full site-wide link audit.

## Website Score (`computeWebsiteAudit`)

The equal-weighted average of SEO, Mobile, Conversion, Technical, and Accessibility:

```
websiteScore = round((seo + mobile + conversion + technical + accessibility) / 5)
```

If there's no website at all, every sub-score — including `websiteScore` itself — is `null`, not
`0`. "Not applicable" and "audited and scored zero" are different facts, and the UI (and the
Opportunity Score below) treat them differently.

## Google Profile Score (`computeGoogleProfileScore`)

Only ever computed when `GoogleBusinessAuditService` returns status `FOUND` — see [Google Business
audit status](#google-business-audit-status) below.

| Signal | Points |
| --- | --- |
| Profile confirmed to exist | 30 |
| Rating ≥ 4.5 / ≥ 4.0 / ≥ 3.0 / below | 20 / 14 / 7 / 0 |
| Review count ≥ 100 / ≥ 50 / ≥ 10 / ≥ 1 / 0 | 20 / 15 / 8 / 3 / 0 |
| Opening hours reported | 10 |
| Phone reported | 10 |
| Website reported | 10 |

**Total: 100 (floor 30 for "found but otherwise empty").**

## Google Business audit status

`GoogleBusinessAuditService` reports one of three statuses, and the product's hard rule is: **never
confidently claim a business does not have a Google Business Profile unless a real, current lookup
against the permitted Google Places data actually came back empty.**

| Status | Meaning |
| --- | --- |
| `FOUND` | A live Places lookup (or, for a mock-mode lead, the same deterministic mock lookup used at discovery time) returned a profile. |
| `NOT_FOUND_IN_CURRENT_SEARCH` | A real lookup was performed and genuinely returned nothing. |
| `UNVERIFIED` | No lookup was possible or it failed — no Google identifier on file, no API key configured, a network error, or a timeout. |

Real Google Place IDs are only ever attached to a lead that was originally discovered via the real
Google Places provider (`GOOGLE` mode) — a mock-mode lead never gets a fabricated real place ID,
even after an audit. `NOT_FOUND_IN_CURRENT_SEARCH` findings and score are only ever produced from a
status of `FOUND`; `UNVERIFIED` and `NOT_FOUND_IN_CURRENT_SEARCH` always score `null`.

## Contactability Score

Unchanged from the Phase 2 Lead Enrichment Engine (`calculateContactabilityScore`, see
`packages/providers/src/website-crawler/contactability-score.ts`): phone (20) + email (20) +
website (15) + Facebook (8) + Instagram (8) + LinkedIn (8) + booking URL (10) + contact page (6) +
contact CTA (5) = 100. It draws on the lead's known phone/email (from any source, not just the
website) plus whatever the latest crawl found.

## Overall Opportunity Score (`computeOpportunityScore`)

This is the score the whole engine exists to produce, and it answers a specific question: **"is
this a real, established business (legitimacy) that a client would visibly benefit from us helping
(digital weakness)?"** It is *not* a quality score — a business can be an excellent, real business
and still score low on opportunity, because there's little left for outreach to offer it.

```
score = legitimacy.total + digitalWeakness.points     (clamped to 0–100)
```

### Legitimacy (max 40 points) — only from a verified Google profile

| Signal | Points |
| --- | --- |
| Rating ≥ 4.5 / ≥ 4.0 / ≥ 3.5 / ≥ 3.0 / below | 15 / 11 / 7 / 3 / 0 |
| Review count ≥ 100 / ≥ 50 / ≥ 20 / ≥ 5 / below | 15 / 11 / 7 / 3 / 0 |
| Business status is `OPERATIONAL` | 10 |

These points are **only** awarded when `GoogleBusinessAuditService` returned status `FOUND`. An
`UNVERIFIED` or `NOT_FOUND_IN_CURRENT_SEARCH` profile contributes zero legitimacy — the engine
never rewards a business it can't actually confirm is real and active.

### Digital weakness (max 60 points) — the inverse of the average digital score

```
averageDigitalScore = mean(websiteScore, seoScore, mobileScore, conversionScore,
                            technicalScore, contactabilityScore)   — missing = 0

digitalWeakness.points = round((100 − averageDigitalScore) / 100 × 60)
```

A missing sub-score (most commonly: no website at all, so SEO/Mobile/Conversion/Technical/
Website are all `null`) counts as its **worst case (0)**, not as excluded from the average — "no
website" *is* the weakness being measured, so it must pull the average down, not disappear from it.

### Level

| Score | Level |
| --- | --- |
| 66–100 | HIGH |
| 33–65 | MEDIUM |
| 0–32 | LOW |

### Worked examples

**Established business, no website (the textbook high-opportunity lead).** Good rating (4.7),
strong review count (150), operational, confirmed via a verified Google profile. No website, so
website/SEO/mobile/conversion/technical are all `null` → 0 in the average; contactability is
modest (say 20, from a phone number on the Google listing).

```
legitimacy   = 15 (rating) + 15 (reviews) + 10 (operational) = 40
avgDigital   = round((0+0+0+0+0+20) / 6) = 3
weakness     = round((100−3)/100 × 60) = 58
score        = 40 + 58 = 98  →  HIGH
```

**Excellent, fully-built-out digital presence (the textbook low-opportunity lead).** Same strong
Google profile (legitimacy = 40), but website/SEO/mobile/conversion/technical/contactability all
score 90–100.

```
avgDigital   = round(~97) = 97
weakness     = round((100−97)/100 × 60) = 2
score        = 40 + 2 = 42  →  MEDIUM (well below the no-website example, as intended)
```

The gap between these two (98 vs. 42) is the point of the formula: the same underlying business
legitimacy produces a dramatically different opportunity score depending purely on how much digital
ground is left to help with.

**Poor website, unverified Google presence.** A real (bad) website exists — scores are low across
the board (website 20, SEO 10, mobile 0, conversion 10, technical 40, contactability 20) — but
there's no verified Google profile (`UNVERIFIED`), so legitimacy is 0.

```
avgDigital   = round(100/6) = 17
weakness     = round((100−17)/100 × 60) = 50
score        = 0 + 50 = 50  →  MEDIUM
```

Even a weak website scores materially lower opportunity than "no website at all with a strong
Google profile" — because legitimacy is unconfirmed here, and there's already *something* to build
on.

### Determinism

`computeOpportunityScore` is a pure function of its inputs — identical inputs always produce an
identical score and breakdown (see `opportunity-scoring.spec.ts`, including an explicit
`toEqual` determinism assertion). The breakdown returned alongside the score
(`OpportunityScoreBreakdown`) is exactly what's shown in the lead audit page's expandable detail —
nothing is summarized away between the engine and the UI.

## Growth Opportunities (`generateGrowthOpportunities`)

Each finding is `{ title, category, severity, evidence, recommendation }`, and — same rule as
everywhere else in this document — a finding is only ever emitted when the underlying signal was
genuinely checked and genuinely absent or weak. A lead with no website never gets a "missing SEO
metadata" finding (there was nothing to check); a lead with an unverified Google profile never gets
"no Google Business Profile found" (that finding requires a real lookup that came back empty).

| Finding | Fires when |
| --- | --- |
| No website detected | `lead.websiteUrl` is null |
| Site is not served over HTTPS | website exists and isn't HTTPS |
| No online booking detected | website exists, no booking link, no contact CTA |
| Weak calls-to-action | Conversion Score < 50 |
| Missing SEO metadata | no `<title>` or no meta description |
| Weak mobile configuration | no viewport meta tag |
| No social links found on website | website exists, zero social links found |
| No clear service pages | website exists, no service/offering content found |
| No Google Business Profile found | Google audit status is `NOT_FOUND_IN_CURRENT_SEARCH` |
| Strong rating but limited review volume | Google audit `FOUND`, rating ≥ 4.3, review count < 10 |

## Testing

- `packages/providers/src/audit/*.spec.ts` — unit tests for every score above, including the
  explicit scenarios this document is built around: an excellent business, a business with no
  website, a poor website, a strong (verified) Google profile, weak contactability, and mixed
  strong/weak signals — plus explicit determinism assertions.
- `apps/worker/src/jobs/lead-enrichment.processor.spec.ts` — the orchestration: Google Business
  audit status resolution (real place ID / mock-mode replay / no identifier on file), score
  persistence, and growth-opportunity generation end to end.
- `apps/api/test/digital-intelligence.e2e-spec.ts` — the read API's pre-audit ("not yet audited")
  and post-audit response shapes, against a real Postgres instance.
