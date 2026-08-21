import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadIntelligenceContext } from "@lead-radar/types";
import { ExternalAIProvider } from "./external-ai.provider";

const createMock = vi.fn();

// vi.mock calls are hoisted above imports by vitest, so this applies before
// external-ai.provider.ts's own `import Anthropic from "@anthropic-ai/sdk"` runs.
// Extending the real class (rather than Object.assign, which only copies own
// *enumerable* properties and misses the SDK's non-enumerable static error
// classes) keeps `Anthropic.NotFoundError` etc. — and their `instanceof`
// checks in the provider — working against the mock.
vi.mock("@anthropic-ai/sdk", async () => {
  const actual = await vi.importActual<typeof import("@anthropic-ai/sdk")>("@anthropic-ai/sdk");
  class MockAnthropic extends actual.default {
    constructor() {
      super({ apiKey: "mock-key" });
      // Narrower-than-real-type on purpose (test double) — assign rather
      // than declare as a class field to sidestep the type mismatch that
      // would otherwise conflict with the parent's `messages: Messages`.
      (this as unknown as { messages: unknown }).messages = {
        create: (...args: unknown[]) => createMock(...args),
      };
    }
  }
  return { ...actual, default: MockAnthropic };
});

function buildContext(): LeadIntelligenceContext {
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
    growthOpportunities: [],
  };
}

afterEach(() => {
  createMock.mockReset();
});

describe("ExternalAIProvider", () => {
  it("throws immediately when constructed without an API key", () => {
    expect(() => new ExternalAIProvider({ apiKey: "" })).toThrow(/requires an apiKey/i);
  });

  it("defaults to claude-opus-5 and low effort, and sends the constructed prompt", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "Strong local reputation." }] });
    const provider = new ExternalAIProvider({ apiKey: "test-key" });

    const result = await provider.generateLeadSummary(buildContext());

    expect(result.text).toBe("Strong local reputation.");
    expect(result.model).toBe("claude-opus-5");
    expect(result.providerMode).toBe("EXTERNAL");

    const call = createMock.mock.calls[0]![0];
    expect(call.model).toBe("claude-opus-5");
    expect(call.output_config).toEqual({ effort: "low" });
    expect(call.messages[0].content).toContain("Example Cafe");
    expect(call.system).toMatch(/never invent/i);
  });

  it("uses a configured model override (e.g. a cheaper model for cost control)", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const provider = new ExternalAIProvider({ apiKey: "test-key", model: "claude-haiku-4-5" });
    await provider.generateLeadSummary(buildContext());
    expect(createMock.mock.calls[0]![0].model).toBe("claude-haiku-4-5");
  });

  it("throws a clear error when the response has no text content", async () => {
    createMock.mockResolvedValue({ content: [] });
    const provider = new ExternalAIProvider({ apiKey: "test-key" });
    await expect(provider.generateLeadSummary(buildContext())).rejects.toThrow(/no text content/i);
  });

  it("parses an outreach message response into subject/body for email", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Subject: Quick thought\nBody: Hi there, I noticed..." }],
    });
    const provider = new ExternalAIProvider({ apiKey: "test-key" });
    const result = await provider.generateOutreachMessage({
      context: buildContext(),
      recommendedServices: [],
      channel: "EMAIL",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
    });
    expect(result.subject).toBe("Quick thought");
    expect(result.body).toContain("Hi there, I noticed");
  });

  it("propagates an unexpected error rather than silently returning fabricated content", async () => {
    createMock.mockRejectedValue(new Error("network exploded"));
    const provider = new ExternalAIProvider({ apiKey: "test-key" });
    await expect(provider.generateLeadSummary(buildContext())).rejects.toThrow("network exploded");
  });
});
