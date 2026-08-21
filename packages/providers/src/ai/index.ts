export { MockAIProvider } from "./mock-ai.provider";
export { LocalAIProvider, type LocalAIProviderConfig } from "./local-ai.provider";
export { ExternalAIProvider, type ExternalAIProviderConfig } from "./external-ai.provider";
export { createAIProvider, type CreateAIProviderOptions } from "./create-ai-provider";
export { mapFindingsToRecommendedServices } from "./recommended-services";
export {
  AI_SYSTEM_PROMPT,
  buildLeadSummaryPrompt,
  buildGrowthOpportunityAnalysisPrompt,
  buildOutreachPrompt,
  buildFollowUpPrompt,
  parseGeneratedMessage,
  type PromptPair,
} from "./prompt";
