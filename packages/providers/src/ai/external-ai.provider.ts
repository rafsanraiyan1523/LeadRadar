import Anthropic from "@anthropic-ai/sdk";
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

export interface ExternalAIProviderConfig {
  apiKey: string;
  /** Any Claude model id — defaults to the current flagship. Short/simple generations here run cheaply on smaller models too (e.g. "claude-haiku-4-5") if an operator wants lower cost. */
  model?: string;
  maxTokens?: number;
  /** These calls happen synchronously in an interactive request (Generate/Regenerate) — capped well under the SDK's 10-minute default so a slow response fails fast instead of hanging the request. */
  timeoutMs?: number;
}

const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * OptionalExternalAIProvider — wraps the real Anthropic API. Server-side
 * only; the API key is never sent to the browser (mirrors the
 * GooglePlacesProvider pattern in lead-discovery). Strictly opt-in: the app
 * is fully functional without it (see MockAIProvider / LocalAIProvider).
 */
export class ExternalAIProvider implements AIProvider {
  readonly mode = "EXTERNAL" as const;
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: ExternalAIProviderConfig) {
    if (!config.apiKey) {
      throw new Error("ExternalAIProvider requires an apiKey — set ANTHROPIC_API_KEY.");
    }
    this.client = new Anthropic({ apiKey: config.apiKey, timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS });
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async generateLeadSummary(context: LeadIntelligenceContext): Promise<GeneratedText> {
    const { system, user } = buildLeadSummaryPrompt(context);
    const text = await this.complete(system, user);
    return { text, model: this.model, providerMode: "EXTERNAL" };
  }

  async generateGrowthOpportunityAnalysis(context: LeadIntelligenceContext): Promise<GeneratedText> {
    const { system, user } = buildGrowthOpportunityAnalysisPrompt(context);
    const text = await this.complete(system, user);
    return { text, model: this.model, providerMode: "EXTERNAL" };
  }

  async generateOutreachMessage(input: OutreachGenerationInput): Promise<GeneratedMessage> {
    const { system, user } = buildOutreachPrompt(input);
    const raw = await this.complete(system, user);
    const { subject, body } = parseGeneratedMessage(raw, input.channel);
    return { subject, body, model: this.model, providerMode: "EXTERNAL" };
  }

  async generateFollowUpMessage(input: FollowUpGenerationInput): Promise<GeneratedMessage> {
    const { system, user } = buildFollowUpPrompt(input);
    const raw = await this.complete(system, user);
    const { subject, body } = parseGeneratedMessage(raw, input.channel);
    return { subject, body, model: this.model, providerMode: "EXTERNAL" };
  }

  private async complete(system: string, userPrompt: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system,
        messages: [{ role: "user", content: userPrompt }],
        output_config: { effort: "low" },
      });

      const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
      if (!textBlock || !textBlock.text.trim()) {
        throw new Error("Claude returned no text content");
      }
      return textBlock.text.trim();
    } catch (error) {
      if (error instanceof Anthropic.NotFoundError) {
        throw new Error(`Claude model not found: ${this.model}`);
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error("Claude API rate limit exceeded — try again shortly");
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error("Claude API authentication failed — check ANTHROPIC_API_KEY");
      }
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error ${error.status ?? "unknown"}: ${error.message}`);
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new Error(`Couldn't reach the Claude API: ${error.message}`);
      }
      throw error;
    }
  }
}
