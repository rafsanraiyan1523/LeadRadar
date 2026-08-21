import { describe, expect, it } from "vitest";
import type { FollowUpGenerationInput, LeadIntelligenceContext, OutreachGenerationInput } from "@lead-radar/types";
import { MockAIProvider } from "./mock-ai.provider";

function buildContext(overrides: Partial<LeadIntelligenceContext> = {}): LeadIntelligenceContext {
  return {
    businessName: "Example Cafe",
    category: "Cafe",
    location: "Banani, Dhaka",
    opportunityScore: 72,
    opportunityLevel: "HIGH",
    website: { exists: false, url: null, score: null, hasSsl: null, hasBookingUrl: false, hasContactCta: false },
    seoScore: null,
    conversionScore: null,
    googleBusiness: { status: "FOUND", rating: 4.6, reviewCount: 150 },
    contactability: { score: 40, hasPhone: true, hasEmail: false, hasFacebook: false, hasInstagram: false, hasLinkedIn: false },
    contactChannels: { phone: "+8801711111111", email: null, website: null, facebookUrl: null, linkedinUrl: null },
    growthOpportunities: [
      {
        title: "No online booking detected",
        category: "conversion",
        severity: "HIGH",
        evidence: "No booking link found.",
        recommendation: "Add an online booking tool.",
      },
    ],
    ...overrides,
  };
}

const provider = new MockAIProvider();

describe("MockAIProvider.generateLeadSummary", () => {
  it("matches the spec's own worked example for a strong-Google/weak-conversion business", async () => {
    const result = await provider.generateLeadSummary(buildContext());
    expect(result.text).toBe("Strong local reputation but limited digital conversion infrastructure.");
    expect(result.providerMode).toBe("MOCK");
  });

  it("is fully deterministic for identical input", async () => {
    const context = buildContext();
    const a = await provider.generateLeadSummary(context);
    const b = await provider.generateLeadSummary(context);
    expect(a).toEqual(b);
  });

  it("never fabricates revenue, employees, or other unsupported categories", async () => {
    const result = await provider.generateLeadSummary(buildContext());
    for (const forbidden of ["revenue", "employee", "customer", "million", "staff"]) {
      expect(result.text.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("falls back honestly when there is no data to summarize", async () => {
    const result = await provider.generateLeadSummary(
      buildContext({ googleBusiness: { status: "UNVERIFIED", rating: null, reviewCount: null }, contactability: { score: 0, hasPhone: false, hasEmail: false, hasFacebook: false, hasInstagram: false, hasLinkedIn: false }, growthOpportunities: [] }),
    );
    expect(result.text).toMatch(/no significant/i);
  });
});

describe("MockAIProvider.generateGrowthOpportunityAnalysis", () => {
  it("references only the given findings, most severe first", async () => {
    const result = await provider.generateGrowthOpportunityAnalysis(
      buildContext({
        growthOpportunities: [
          { title: "No social links found on website", category: "social", severity: "LOW", evidence: "e", recommendation: "r1" },
          { title: "No website detected", category: "website", severity: "HIGH", evidence: "e", recommendation: "r2" },
        ],
      }),
    );
    expect(result.text.toLowerCase().indexOf("no website detected")).toBeLessThan(
      result.text.toLowerCase().indexOf("no social links"),
    );
  });

  it("reports honestly when nothing has been detected", async () => {
    const result = await provider.generateGrowthOpportunityAnalysis(buildContext({ growthOpportunities: [] }));
    expect(result.text).toMatch(/no growth opportunities/i);
  });
});

describe("MockAIProvider.generateOutreachMessage", () => {
  const baseInput: OutreachGenerationInput = {
    context: buildContext(),
    recommendedServices: [{ service: "ONLINE_BOOKING", triggeredBy: ["No online booking detected"] }],
    channel: "EMAIL",
    tone: "PROFESSIONAL",
    language: "ENGLISH",
  };

  it("produces the exact example phrasing from the spec when both a strength and a gap are present", async () => {
    const result = await provider.generateOutreachMessage(baseInput);
    expect(result.body).toContain("your Google profile has a strong rating");
    expect(result.body).toContain("but I couldn't find an online booking option");
  });

  it("includes a subject line for email and none for other channels", async () => {
    const email = await provider.generateOutreachMessage(baseInput);
    expect(email.subject).not.toBeNull();

    const whatsapp = await provider.generateOutreachMessage({ ...baseInput, channel: "WHATSAPP" });
    expect(whatsapp.subject).toBeNull();
  });

  it("produces distinct output per tone", async () => {
    const professional = await provider.generateOutreachMessage(baseInput);
    const friendly = await provider.generateOutreachMessage({ ...baseInput, tone: "FRIENDLY" });
    const short = await provider.generateOutreachMessage({ ...baseInput, tone: "SHORT" });
    expect(professional.body).not.toBe(friendly.body);
    expect(short.body.length).toBeLessThan(professional.body.length);
  });

  it("produces Bangla script for BANGLA and Latin script for BANGLISH", async () => {
    const bangla = await provider.generateOutreachMessage({ ...baseInput, language: "BANGLA" });
    const banglish = await provider.generateOutreachMessage({ ...baseInput, language: "BANGLISH" });
    expect(bangla.body).toMatch(/[ঀ-৿]/); // Bengali Unicode block
    expect(banglish.body).not.toMatch(/[ঀ-৿]/);
  });

  it("only recommends the service actually passed in", async () => {
    const result = await provider.generateOutreachMessage(baseInput);
    expect(result.body.toLowerCase()).toContain("online booking");
    expect(result.body.toLowerCase()).not.toContain("paid ads");
  });

  it("never claims a business is losing customers or fabricates a rating that wasn't given", async () => {
    const noGoogleData = await provider.generateOutreachMessage({
      ...baseInput,
      context: buildContext({ googleBusiness: { status: "UNVERIFIED", rating: null, reviewCount: null } }),
    });
    expect(noGoogleData.body.toLowerCase()).not.toContain("losing customers");
    expect(noGoogleData.body).not.toMatch(/★/);
  });

  it("is fully deterministic for identical input", async () => {
    const a = await provider.generateOutreachMessage(baseInput);
    const b = await provider.generateOutreachMessage(baseInput);
    expect(a).toEqual(b);
  });
});

describe("MockAIProvider.generateFollowUpMessage", () => {
  const followUpInput: FollowUpGenerationInput = {
    context: buildContext(),
    recommendedServices: [],
    channel: "EMAIL",
    tone: "FRIENDLY",
    language: "ENGLISH",
    previousMessage: { body: "Hi there, saw your cafe...", channel: "EMAIL", sentAt: "2026-08-01T00:00:00Z" },
  };

  it("opens by referencing the earlier outreach, not a fresh introduction", async () => {
    const result = await provider.generateFollowUpMessage(followUpInput);
    expect(result.body).toMatch(/following up/i);
  });

  it("differs from a fresh outreach message for the same lead", async () => {
    const followUp = await provider.generateFollowUpMessage(followUpInput);
    const outreach = await provider.generateOutreachMessage(followUpInput);
    expect(followUp.body).not.toBe(outreach.body);
  });
});
