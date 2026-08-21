# AI — business intelligence & outreach

This document covers the AI architecture added in Phase 4: turning the Digital Intelligence
Engine's verified findings (see [docs/scoring.md](scoring.md)) into a lead summary, a growth
opportunity analysis, recommended services, and personalized outreach/follow-up messages.

## The AI rule

**An AIProvider may only reason over `LeadIntelligenceContext`** (`@lead-radar/types/ai`) — a type
assembled entirely from already-verified LeadRadar data (the crawl, a verified Google Business
lookup, rule-based growth-opportunity findings). It has no field for revenue, employee count,
customer count, business history, marketing spend, or technology beyond what the crawler actually
fingerprinted. This is enforced two ways:

1. **Structurally** — those categories simply don't exist on `LeadIntelligenceContext`, so there is
   nothing for a provider to read them from, even a misbehaving one.
2. **By instruction** — `AI_SYSTEM_PROMPT` (`packages/providers/src/ai/prompt.ts`) explicitly lists
   the forbidden categories and forbids claims like "losing customers" without a specific
   evidencing finding. This is the backstop for LOCAL/EXTERNAL models, which (unlike the
   deterministic MockAIProvider) aren't otherwise guaranteed to stay inside the given facts.

Recommended Services follows an even stricter rule: it is **not AI-generated at all**. See
[Recommended Services](#recommended-services) below.

## AIProvider architecture

```ts
interface AIProvider {
  readonly mode: "MOCK" | "LOCAL" | "EXTERNAL";
  generateLeadSummary(context): Promise<GeneratedText>;
  generateGrowthOpportunityAnalysis(context): Promise<GeneratedText>;
  generateOutreachMessage(input): Promise<GeneratedMessage>;
  generateFollowUpMessage(input): Promise<GeneratedMessage>;
}
```

`createAIProvider({ mode, local?, external? })` (`packages/providers/src/ai/create-ai-provider.ts`)
is the single place that decides which implementation backs `AI_MODE` — same pattern as
`createLeadDiscoveryProvider`. It defaults to `MockAIProvider` whenever `LOCAL`/`EXTERNAL` is
requested without the configuration it needs, rather than throwing, so the app never breaks from a
configuration drift.

| `AI_MODE` | Implementation | Requires | Cost |
| --- | --- | --- | --- |
| `mock` (default) | `MockAIProvider` | nothing | zero — deterministic templates |
| `local` | `LocalAIProvider` | a running Ollama instance | zero — everything stays on the machine |
| `external` | `ExternalAIProvider` | `ANTHROPIC_API_KEY` | pay-per-call to the real Anthropic API |

### MockAIProvider

Fully deterministic and template-based (`packages/providers/src/ai/mock-ai.provider.ts` +
`mock-phrases.ts`) — **not** random filler. It genuinely composes from the verified context: a
strength clause (only when evidenced — a real Google rating, or high contactability) plus a gap
clause drawn from the single most severe already-detected finding, e.g. the spec's own worked
example: *"your Google profile has a strong rating (4.6★, 150 reviews), but I couldn't find an
online booking option."* Supports English, Bangla, and Banglish natively (hand-written, reviewed
phrase banks — not machine-translated at runtime).

### LocalAIProvider (Ollama)

For truly zero-cost local development. Install [Ollama](https://ollama.com), pull a model (e.g.
`ollama pull llama3.2`), then set:

```
AI_MODE=local
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

If Ollama isn't reachable, generation fails with a clear, actionable error — it never silently
substitutes mock output pretending to be a real model's response.

### ExternalAIProvider (Anthropic)

Opt-in only, server-side, mirrors `GooglePlacesProvider`'s pattern (the API key never reaches the
browser):

```
AI_MODE=external
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5
```

Short, simple generations like these run cheaply on a smaller model too — set `ANTHROPIC_MODEL=
claude-haiku-4-5` for lower per-call cost if desired. Requests run at `output_config.effort: "low"`
with a capped `max_tokens`/timeout, since generation happens synchronously inside an interactive
API request (Generate/Regenerate), not a background job.

## AI features

1. **Lead Summary** — one sentence, e.g. *"Strong local reputation but limited digital conversion
   infrastructure."*
2. **Growth Opportunity Analysis** — a short paragraph synthesizing the already-detected
   `GrowthOpportunity` findings, most severe first. Never introduces a finding that wasn't already
   detected by the Digital Intelligence Engine.
3. **Recommended Services**
4. **Outreach Message**
5. **Follow-up Message**

### Recommended Services

`mapFindingsToRecommendedServices` (`packages/providers/src/ai/recommended-services.ts`) is a pure,
deterministic, rule-based function — not an AI call. Each of the eight services (Website
Development, SEO, Google Business Optimization, Online Booking, E-commerce, Social Media, Paid Ads,
Custom Software) is only ever recommended when a specific detected finding evidences it. E-commerce
and Paid Ads currently have no detector in the Digital Intelligence Engine, so they can never be
recommended yet — that's correct behavior, not a gap.

### Outreach & follow-up generation

`OutreachGenerationInput` combines the verified context, the (rule-based) recommended services, and
the user's choices:

- **Channels:** Email, WhatsApp, Facebook, LinkedIn, SMS
- **Tones:** Professional, Friendly, Consultative, Short
- **Languages:** English, Bangla, Banglish

A follow-up additionally references a real, on-file prior `OutreachMessage` (looked up server-side
by id — the API never trusts client-supplied "previous message" text), so the AI reasons over
verified history only, never a fabricated conversation.

Message quality rules (see `AI_SYSTEM_PROMPT` and the Mock provider's phrase banks): short, human,
specific, personalized, non-aggressive, and grounded in an actual finding or fact. The banned
framing — *"I noticed your business is losing customers"* without evidence — is called out
explicitly; the correct, evidenced alternative is demonstrated throughout.

## Outreach UX

The user stays in control at every step — this is not automated or bulk messaging:

- **Generate** — an explicit action, never automatic (see AI Cost Control below).
- **Edit** — `PATCH /leads/:id/outreach/:messageId` lets the user change the subject/body before
  sending.
- **Copy** / **Regenerate** — regenerate always creates a *new* `OutreachMessage` row (history is
  kept, nothing is overwritten), so a user can compare or revert.
- **Character count** — a client-side concern (the API doesn't truncate).
- **Open Email / WhatsApp / Facebook / Website** — built client-side from the lead's own verified
  contact channels (`mailto:`, WhatsApp `wa.me` deep link from the on-file phone number, the
  lead's Facebook URL, the lead's website) — LeadRadar never sends anything on the user's behalf.
- **Mark sent** — `PATCH .../outreach/:messageId` with `{status: "SENT"}`, set only when the user
  says so (e.g. after they've actually opened the channel and sent it manually).

## AI cost control

- AI is **never** called automatically for a lead — only in response to an explicit
  Generate/Regenerate request (`POST /leads/:id/insight/generate`, `.../outreach/generate`, or
  `.../outreach/follow-up`).
- **Caching:** `AIInsight` is a single cached row per lead, fingerprinted by `inputsHash` — a hash
  of the exact `LeadIntelligenceContext` that produced it. A repeat "Generate insight" request with
  unchanged underlying data serves the cache directly, without calling the AI provider again.
  Outreach/follow-up messages are not cached (each Regenerate is a deliberate request for a new
  variation), but every request — cached or not — is throttled.
- **Usage tracking:** every AI call, including cache hits, writes an `AIUsageEvent` row
  (`organizationId`, `userId`, `leadId`, `feature`, `providerMode`, `model`, `cached`) — the
  foundation for a future AI-usage view.

## Testing

- `packages/providers/src/ai/*.spec.ts` — MockAIProvider (including the spec's own worked example,
  determinism, forbidden-claim absence, per-tone/per-language variation, Bangla/Banglish script
  checks), LocalAIProvider (Ollama request shape, timeout, unreachable-server error), prompt
  construction (forbidden-category coverage, conditional fact inclusion, tone/channel/language
  switching), `parseGeneratedMessage`, `mapFindingsToRecommendedServices` (including that
  E-commerce/Paid Ads are never recommended), and `createAIProvider`'s fallback behavior.
- `apps/api/test/ai.e2e-spec.ts` — org isolation, the insight cache (including a real
  `AIUsageEvent.cached` assertion), outreach DTO validation, outreach/follow-up generation
  (including a real Bangla-script assertion against Postgres — see the embedded-postgres encoding
  note below), and the edit/mark-sent flow.

**Windows-only test-infra note:** the zero-Docker embedded Postgres used for local e2e tests
inherits the host OS locale by default, which silently created a `WIN1252` database that can't
store Bangla text. Fixed by forcing `initdb --encoding=UTF8 --locale=C` in
`apps/api/test/setup/global-setup.ts`. Docker's official `postgres` image is unaffected (it already
defaults to UTF8 regardless of host locale) — this only ever bit the native Windows dev/test path.
