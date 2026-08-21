import type { AIProvider, AIProviderMode } from "@lead-radar/types";
import { MockAIProvider } from "./mock-ai.provider";
import { LocalAIProvider, type LocalAIProviderConfig } from "./local-ai.provider";
import { ExternalAIProvider, type ExternalAIProviderConfig } from "./external-ai.provider";

export interface CreateAIProviderOptions {
  mode: AIProviderMode;
  local?: LocalAIProviderConfig;
  external?: ExternalAIProviderConfig;
}

/**
 * Single place that decides which AIProvider backs AI_MODE. Defaults to
 * MockAIProvider whenever LOCAL/EXTERNAL is requested without the
 * configuration it needs, rather than throwing — the app must keep
 * working at zero cost even if configuration drifts. See docs/ai.md.
 */
export function createAIProvider(options: CreateAIProviderOptions): AIProvider {
  if (options.mode === "LOCAL" && options.local?.model) {
    return new LocalAIProvider(options.local);
  }
  if (options.mode === "EXTERNAL" && options.external?.apiKey) {
    return new ExternalAIProvider(options.external);
  }
  return new MockAIProvider();
}
