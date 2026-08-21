import { describe, expect, it } from "vitest";
import type { LeadIntelligenceContext, OutreachGenerationInput } from "@lead-radar/types";
import {
  AI_SYSTEM_PROMPT,
  buildFollowUpPrompt,
  buildGrowthOpportunityAnalysisPrompt,
  buildLeadSummaryPrompt,
  buildOutreachPrompt,
  parseGeneratedMessage,
} from "./prompt";

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
        title: "No website detected",
        category: "website",
        severity: "HIGH",
        evidence: "No website URL is on file for this business.",
        recommendation: "Build a professional website.",
      },
    ],
    ...overrides,
  };
}

describe("AI_SYSTEM_PROMPT", () => {
  it("explicitly forbids every category the AI RULE prohibits", () => {
    for (const forbidden of ["revenue", "employee count", "customer count", "business history", "marketing spend"]) {
      expect(AI_SYSTEM_PROMPT.toLowerCase()).toContain(forbidden);
    }
  });

  it("forbids the specific 'losing customers' framing without evidence", () => {
    expect(AI_SYSTEM_PROMPT.toLowerCase()).toContain("losing customers");
  });
});

describe("buildLeadSummaryPrompt", () => {
  it("includes the system prompt and the business's verified facts", () => {
    const { system, user } = buildLeadSummaryPrompt(buildContext());
    expect(system).toBe(AI_SYSTEM_PROMPT);
    expect(user).toContain("Example Cafe");
    expect(user).toContain("Google rating: 4.6");
  });

  it("never mentions SEO/conversion scores when there is no website to audit", () => {
    const { user } = buildLeadSummaryPrompt(buildContext());
    expect(user).toContain("Website: none found");
    expect(user).not.toContain("SEO score");
    expect(user).not.toContain("Conversion score");
  });

  it("includes SEO/conversion scores only when a website was actually audited", () => {
    const { user } = buildLeadSummaryPrompt(
      buildContext({
        website: { exists: true, url: "https://example.test", score: 55, hasSsl: true, hasBookingUrl: false, hasContactCta: true },
        seoScore: 40,
        conversionScore: 60,
      }),
    );
    expect(user).toContain("SEO score: 40/100");
    expect(user).toContain("Conversion score: 60/100");
  });

  it("never claims a Google profile is found or absent when the status is unverified", () => {
    const { user } = buildLeadSummaryPrompt(
      buildContext({ googleBusiness: { status: "UNVERIFIED", rating: null, reviewCount: null } }),
    );
    expect(user).toContain("unverified");
    expect(user).not.toContain("Google rating");
  });
});

describe("buildGrowthOpportunityAnalysisPrompt", () => {
  it("lists only the given findings and instructs against inventing more", () => {
    const { user } = buildGrowthOpportunityAnalysisPrompt(buildContext());
    expect(user).toContain("No website detected");
    expect(user).toMatch(/do not invent/i);
  });

  it("reports 'none' rather than fabricating a finding when there are none", () => {
    const { user } = buildGrowthOpportunityAnalysisPrompt(buildContext({ growthOpportunities: [] }));
    expect(user).toContain("Detected findings: none");
  });
});

describe("buildOutreachPrompt", () => {
  const baseInput: OutreachGenerationInput = {
    context: buildContext(),
    recommendedServices: [{ service: "WEBSITE_DEVELOPMENT", triggeredBy: ["No website detected"] }],
    channel: "EMAIL",
    tone: "PROFESSIONAL",
    language: "ENGLISH",
  };

  it("reflects the requested tone, channel, and language", () => {
    const { user } = buildOutreachPrompt(baseInput);
    expect(user).toMatch(/professional/i);
    expect(user).toMatch(/email/i);
    expect(user).toMatch(/english/i);
  });

  it("only lists the recommended services actually passed in", () => {
    const { user } = buildOutreachPrompt(baseInput);
    expect(user).toContain("WEBSITE DEVELOPMENT");
    expect(user).not.toContain("PAID ADS");
  });

  it("switches instructions for Bangla and Banglish", () => {
    const bangla = buildOutreachPrompt({ ...baseInput, language: "BANGLA" });
    expect(bangla.user).toMatch(/bengali script/i);

    const banglish = buildOutreachPrompt({ ...baseInput, language: "BANGLISH" });
    expect(banglish.user).toMatch(/banglish/i);
  });

  it("instructs SMS messages to stay short with no subject line", () => {
    const { user } = buildOutreachPrompt({ ...baseInput, channel: "SMS" });
    expect(user).toMatch(/no subject line/i);
    expect(user).toMatch(/320 characters/);
  });
});

describe("parseGeneratedMessage", () => {
  it("parses a well-formatted email response into subject and body", () => {
    const result = parseGeneratedMessage("Subject: Quick thought about Example Cafe\nBody: Hi there, ...", "EMAIL");
    expect(result.subject).toBe("Quick thought about Example Cafe");
    expect(result.body).toBe("Hi there, ...");
  });

  it("falls back to treating the whole text as the body when an email response doesn't follow the format", () => {
    const result = parseGeneratedMessage("Hi there, just a quick note...", "EMAIL");
    expect(result.subject).toBeNull();
    expect(result.body).toBe("Hi there, just a quick note...");
  });

  it("treats non-email channel text as the body verbatim", () => {
    const result = parseGeneratedMessage("Hey! Quick note about your cafe.", "WHATSAPP");
    expect(result.subject).toBeNull();
    expect(result.body).toBe("Hey! Quick note about your cafe.");
  });

  it("strips a stray Subject:/Body: prefix from a non-email response defensively", () => {
    const result = parseGeneratedMessage("Body: Hey! Quick note.", "SMS");
    expect(result.body).toBe("Hey! Quick note.");
  });
});

describe("buildFollowUpPrompt", () => {
  it("includes the previous message and instructs not to repeat it verbatim", () => {
    const { user } = buildFollowUpPrompt({
      context: buildContext(),
      recommendedServices: [],
      channel: "EMAIL",
      tone: "FRIENDLY",
      language: "ENGLISH",
      previousMessage: { body: "Hi there, saw your cafe has no website...", channel: "EMAIL", sentAt: "2026-08-01" },
    });
    expect(user).toContain("saw your cafe has no website");
    expect(user).toMatch(/do not repeat/i);
  });
});
