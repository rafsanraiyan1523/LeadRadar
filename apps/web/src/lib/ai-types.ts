export type AIProviderMode = "MOCK" | "LOCAL" | "EXTERNAL";
export type OutreachChannel = "EMAIL" | "WHATSAPP" | "FACEBOOK" | "LINKEDIN" | "SMS";
export type OutreachTone = "PROFESSIONAL" | "FRIENDLY" | "CONSULTATIVE" | "SHORT";
export type OutreachLanguage = "ENGLISH" | "BANGLA" | "BANGLISH";
export type OutreachKind = "OUTREACH" | "FOLLOW_UP";
export type OutreachStatus = "DRAFT" | "SENT";
export type RecommendedServiceType =
  | "WEBSITE_DEVELOPMENT"
  | "SEO"
  | "GOOGLE_BUSINESS_OPTIMIZATION"
  | "ONLINE_BOOKING"
  | "ECOMMERCE"
  | "SOCIAL_MEDIA"
  | "PAID_ADS"
  | "CUSTOM_SOFTWARE";

export interface AIInsight {
  id: string;
  leadId: string;
  summary: string;
  growthAnalysis: string;
  recommendedServices: RecommendedServiceType[];
  providerMode: AIProviderMode;
  model: string;
  generatedAt: string;
}

export interface OutreachMessage {
  id: string;
  leadId: string;
  kind: OutreachKind;
  channel: OutreachChannel;
  tone: OutreachTone;
  language: OutreachLanguage;
  subject: string | null;
  body: string;
  status: OutreachStatus;
  providerMode: AIProviderMode;
  model: string;
  sentAt: string | null;
  createdAt: string;
}

export const RECOMMENDED_SERVICE_LABELS: Record<RecommendedServiceType, string> = {
  WEBSITE_DEVELOPMENT: "Website Development",
  SEO: "SEO",
  GOOGLE_BUSINESS_OPTIMIZATION: "Google Business Optimization",
  ONLINE_BOOKING: "Online Booking",
  ECOMMERCE: "E-commerce",
  SOCIAL_MEDIA: "Social Media",
  PAID_ADS: "Paid Ads",
  CUSTOM_SOFTWARE: "Custom Software",
};
