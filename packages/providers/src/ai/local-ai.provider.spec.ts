import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadIntelligenceContext, OutreachGenerationInput } from "@lead-radar/types";
import { LocalAIProvider } from "./local-ai.provider";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
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

function mockOllama(responseText: string, status = 200) {
  globalThis.fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
    expect(url).toContain("/api/generate");
    const body = JSON.parse(init.body as string);
    expect(body.stream).toBe(false);
    return Promise.resolve(
      new Response(JSON.stringify({ response: responseText }), { status, headers: { "content-type": "application/json" } }),
    );
  }) as unknown as typeof fetch;
}

describe("LocalAIProvider", () => {
  it("throws immediately when constructed without a model", () => {
    expect(() => new LocalAIProvider({ model: "" })).toThrow(/requires a model/i);
  });

  it("generates a lead summary via the local Ollama API", async () => {
    mockOllama("Strong local reputation but limited digital conversion infrastructure.");
    const provider = new LocalAIProvider({ model: "llama3.2" });
    const result = await provider.generateLeadSummary(buildContext());
    expect(result.text).toContain("Strong local reputation");
    expect(result.providerMode).toBe("LOCAL");
    expect(result.model).toBe("llama3.2");
  });

  it("parses a well-formatted email outreach response into subject/body", async () => {
    mockOllama("Subject: Quick thought about Example Cafe\nBody: Hi there, loved your cafe...");
    const provider = new LocalAIProvider({ model: "llama3.2" });
    const input: OutreachGenerationInput = {
      context: buildContext(),
      recommendedServices: [],
      channel: "EMAIL",
      tone: "PROFESSIONAL",
      language: "ENGLISH",
    };
    const result = await provider.generateOutreachMessage(input);
    expect(result.subject).toBe("Quick thought about Example Cafe");
    expect(result.body).toContain("Hi there, loved your cafe");
  });

  it("surfaces a clear error when Ollama is unreachable rather than silently falling back", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed")) as unknown as typeof fetch;
    const provider = new LocalAIProvider({ model: "llama3.2" });
    await expect(provider.generateLeadSummary(buildContext())).rejects.toThrow(/is it running/i);
  });

  it("surfaces a clear error on a non-2xx Ollama response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("model not found", { status: 404 })) as unknown as typeof fetch;
    const provider = new LocalAIProvider({ model: "does-not-exist" });
    await expect(provider.generateLeadSummary(buildContext())).rejects.toThrow(/404/);
  });

  it("times out cleanly instead of hanging forever", async () => {
    globalThis.fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;
    const provider = new LocalAIProvider({ model: "llama3.2", requestTimeoutMs: 20 });
    await expect(provider.generateLeadSummary(buildContext())).rejects.toThrow(/timed out/i);
  });
});
