import type { GoogleProfileStatus, GrowthOpportunityFinding, OpportunityLevel } from "./digital-intelligence";

export type AIProviderMode = "MOCK" | "LOCAL" | "EXTERNAL";

export type OutreachChannel = "EMAIL" | "WHATSAPP" | "FACEBOOK" | "LINKEDIN" | "SMS";

export type OutreachTone = "PROFESSIONAL" | "FRIENDLY" | "CONSULTATIVE" | "SHORT";

export type OutreachLanguage = "ENGLISH" | "BANGLA" | "BANGLISH";

export type OutreachKind = "OUTREACH" | "FOLLOW_UP";

/**
 * The eight-service catalog AI/rule-based recommendations are drawn from.
 * A service only ever appears in a RecommendedService list when a specific,
 * detected GrowthOpportunityFinding evidences it — see
 * mapFindingsToRecommendedServices. E-commerce and Paid Ads currently have
 * no detector, so they can never be recommended yet (not a bug — there is
 * simply no verified signal for either today).
 */
export type RecommendedServiceType =
  | "WEBSITE_DEVELOPMENT"
  | "SEO"
  | "GOOGLE_BUSINESS_OPTIMIZATION"
  | "ONLINE_BOOKING"
  | "ECOMMERCE"
  | "SOCIAL_MEDIA"
  | "PAID_ADS"
  | "CUSTOM_SOFTWARE";

export interface RecommendedService {
  service: RecommendedServiceType;
  /** The specific detected finding title(s) that justify this recommendation — never invented. */
  triggeredBy: string[];
}

/**
 * Everything an AIProvider is allowed to reason over — assembled entirely
 * from already-verified LeadRadar data (crawl results, a verified Google
 * Business lookup, rule-based growth-opportunity findings). There is no
 * field here for revenue, employee count, customer count, business
 * history, marketing spend, or technology beyond what the crawler actually
 * fingerprinted — those categories are simply absent from this type, so an
 * AIProvider implementation has nothing to hallucinate from even if it
 * tried. See the AI RULE in docs/scoring.md (Digital Intelligence Engine)
 * and docs/ai.md.
 */
export interface LeadIntelligenceContext {
  businessName: string;
  category: string | null;
  location: string | null;
  opportunityScore: number | null;
  opportunityLevel: OpportunityLevel | null;
  website: {
    exists: boolean;
    url: string | null;
    score: number | null;
    hasSsl: boolean | null;
    hasBookingUrl: boolean;
    hasContactCta: boolean;
  };
  seoScore: number | null;
  conversionScore: number | null;
  googleBusiness: {
    status: GoogleProfileStatus;
    rating: number | null;
    reviewCount: number | null;
  };
  contactability: {
    score: number;
    hasPhone: boolean;
    hasEmail: boolean;
    hasFacebook: boolean;
    hasInstagram: boolean;
    hasLinkedIn: boolean;
  };
  contactChannels: {
    phone: string | null;
    email: string | null;
    website: string | null;
    facebookUrl: string | null;
    linkedinUrl: string | null;
  };
  /** Already-detected, evidence-backed findings — the only source of "problems" an AIProvider may reference. */
  growthOpportunities: GrowthOpportunityFinding[];
}

export interface GeneratedText {
  text: string;
  model: string;
  providerMode: AIProviderMode;
}

export interface LeadInsight {
  summary: GeneratedText;
  growthAnalysis: GeneratedText;
  recommendedServices: RecommendedService[];
}

export interface OutreachGenerationInput {
  context: LeadIntelligenceContext;
  recommendedServices: RecommendedService[];
  channel: OutreachChannel;
  tone: OutreachTone;
  language: OutreachLanguage;
}

export interface FollowUpGenerationInput extends OutreachGenerationInput {
  previousMessage: { body: string; channel: OutreachChannel; sentAt: string | null };
}

export interface GeneratedMessage {
  subject: string | null;
  body: string;
  model: string;
  providerMode: AIProviderMode;
}

export interface AIProvider {
  readonly mode: AIProviderMode;
  generateLeadSummary(context: LeadIntelligenceContext): Promise<GeneratedText>;
  generateGrowthOpportunityAnalysis(context: LeadIntelligenceContext): Promise<GeneratedText>;
  generateOutreachMessage(input: OutreachGenerationInput): Promise<GeneratedMessage>;
  generateFollowUpMessage(input: FollowUpGenerationInput): Promise<GeneratedMessage>;
}
