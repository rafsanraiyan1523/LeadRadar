import type {
  AIProvider,
  FollowUpGenerationInput,
  GeneratedMessage,
  GeneratedText,
  LeadIntelligenceContext,
  OutreachGenerationInput,
} from "@lead-radar/types";
import {
  buildFollowUpPrompt,
  buildGrowthOpportunityAnalysisPrompt,
  buildLeadSummaryPrompt,
  buildOutreachPrompt,
  parseGeneratedMessage,
} from "./prompt";

export interface LocalAIProviderConfig {
  /** Ollama's HTTP API base URL — default http://localhost:11434, no external account or spend required. */
  baseUrl?: string;
  /** Any locally-pulled Ollama model, e.g. "llama3.2". */
  model: string;
  requestTimeoutMs?: number;
}

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_TIMEOUT_MS = 30_000;

interface OllamaGenerateResponse {
  response?: string;
  error?: string;
}

/**
 * Wraps a local Ollama instance — the "truly zero-cost local development"
 * option: no external account, no API key, everything stays on the
 * developer's machine. If Ollama isn't running, generation fails loudly
 * with a clear error rather than silently substituting mock output.
 */
export class LocalAIProvider implements AIProvider {
  readonly mode = "LOCAL" as const;

  constructor(private readonly config: LocalAIProviderConfig) {
    if (!config.model) {
      throw new Error("LocalAIProvider requires a model (e.g. 'llama3.2') — set OLLAMA_MODEL.");
    }
  }

  async generateLeadSummary(context: LeadIntelligenceContext): Promise<GeneratedText> {
    const { system, user } = buildLeadSummaryPrompt(context);
    const text = await this.complete(system, user);
    return { text, model: this.config.model, providerMode: "LOCAL" };
  }

  async generateGrowthOpportunityAnalysis(context: LeadIntelligenceContext): Promise<GeneratedText> {
    const { system, user } = buildGrowthOpportunityAnalysisPrompt(context);
    const text = await this.complete(system, user);
    return { text, model: this.config.model, providerMode: "LOCAL" };
  }

  async generateOutreachMessage(input: OutreachGenerationInput): Promise<GeneratedMessage> {
    const { system, user } = buildOutreachPrompt(input);
    const raw = await this.complete(system, user);
    const { subject, body } = parseGeneratedMessage(raw, input.channel);
    return { subject, body, model: this.config.model, providerMode: "LOCAL" };
  }

  async generateFollowUpMessage(input: FollowUpGenerationInput): Promise<GeneratedMessage> {
    const { system, user } = buildFollowUpPrompt(input);
    const raw = await this.complete(system, user);
    const { subject, body } = parseGeneratedMessage(raw, input.channel);
    return { subject, body, model: this.config.model, providerMode: "LOCAL" };
  }

  private async complete(system: string, prompt: string): Promise<string> {
    const baseUrl = this.config.baseUrl ?? DEFAULT_BASE_URL;
    const timeoutMs = this.config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          system,
          prompt,
          stream: false,
          options: { temperature: 0.4 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Ollama request failed (${response.status}): ${text || response.statusText}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      if (data.error) throw new Error(`Ollama error: ${data.error}`);
      if (!data.response || !data.response.trim()) {
        throw new Error("Ollama returned an empty response");
      }
      return data.response.trim();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Ollama request timed out after ${timeoutMs}ms — is Ollama running at ${baseUrl}?`);
      }
      if (error instanceof Error && /fetch failed|ECONNREFUSED/i.test(error.message)) {
        throw new Error(`Couldn't reach Ollama at ${baseUrl} — is it running? (AI_MODE=local requires a local Ollama server.)`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
