import { describe, expect, it } from "vitest";
import { createAIProvider } from "./create-ai-provider";
import { MockAIProvider } from "./mock-ai.provider";
import { LocalAIProvider } from "./local-ai.provider";
import { ExternalAIProvider } from "./external-ai.provider";

describe("createAIProvider", () => {
  it("defaults to MockAIProvider for MOCK mode", () => {
    expect(createAIProvider({ mode: "MOCK" })).toBeInstanceOf(MockAIProvider);
  });

  it("returns LocalAIProvider when LOCAL mode is configured with a model", () => {
    const provider = createAIProvider({ mode: "LOCAL", local: { model: "llama3.2" } });
    expect(provider).toBeInstanceOf(LocalAIProvider);
  });

  it("falls back to MockAIProvider when LOCAL is requested without a model configured", () => {
    expect(createAIProvider({ mode: "LOCAL" })).toBeInstanceOf(MockAIProvider);
  });

  it("returns ExternalAIProvider when EXTERNAL mode is configured with an API key", () => {
    const provider = createAIProvider({ mode: "EXTERNAL", external: { apiKey: "test-key" } });
    expect(provider).toBeInstanceOf(ExternalAIProvider);
  });

  it("falls back to MockAIProvider when EXTERNAL is requested without an API key configured", () => {
    expect(createAIProvider({ mode: "EXTERNAL" })).toBeInstanceOf(MockAIProvider);
  });
});
