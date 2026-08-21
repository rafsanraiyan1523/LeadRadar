import type { LeadStatus } from "./crm-types";

export type GoogleProfileStatus = "FOUND" | "NOT_FOUND_IN_CURRENT_SEARCH" | "UNVERIFIED";
export type OpportunityLevel = "HIGH" | "MEDIUM" | "LOW";
export type FindingSeverity = "LOW" | "MEDIUM" | "HIGH";
export type FindingCategory =
  | "website"
  | "seo"
  | "conversion"
  | "mobile"
  | "technical"
  | "google-business"
  | "social"
  | "content";

export interface LeadAuditSummary {
  id: string;
  businessName: string;
  category: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  leadStatus: LeadStatus;
  createdAt: string;
  lastEnrichedAt: string | null;
  enrichmentStatus: "NOT_STARTED" | "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  enrichmentProgress: number;
  enrichmentError: string | null;
}

export interface WebsitePerformanceSignals {
  homepageResponseTimeMs: number | null;
  homepageSizeBytes: number | null;
}

export interface WebsiteAuditView {
  websiteScore: number | null;
  seoScore: number | null;
  mobileScore: number | null;
  conversionScore: number | null;
  technicalScore: number | null;
  accessibilityScore: number | null;
  hasSsl: boolean | null;
  isMobileFriendly: boolean | null;
  techStack: string[];
  issues: string[];
  url: string | null;
  pagesCrawled: number | null;
  lastCheckedAt: string | null;
  auditedAt: string | null;
  performance: WebsitePerformanceSignals | null;
  brokenLinksChecked: number | null;
  brokenLinksFound: number | null;
}

export interface SeoAuditView {
  score: number | null;
  breakdown: Record<string, boolean> | null;
}

export interface ContactabilityBreakdown {
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasBookingUrl: boolean;
  hasContactPage: boolean;
  hasContactCta: boolean;
}

export interface ConversionAuditView {
  score: number | null;
  breakdown: Record<string, boolean> | null;
  contactability: { score: number; breakdown: Record<keyof ContactabilityBreakdown, boolean> };
}

export interface GoogleBusinessSignals {
  displayName: string | null;
  primaryCategory: string | null;
  categories: string[];
  rating: number | null;
  userRatingCount: number | null;
  businessStatus: string | null;
  phone: string | null;
  websiteUrl: string | null;
  address: string | null;
  openingHours: string[] | null;
  mapsUri: string | null;
  photosAvailable: boolean | null;
}

export interface GoogleBusinessAuditView {
  status: GoogleProfileStatus;
  score: number | null;
  signals: GoogleBusinessSignals | null;
  reason: string | null;
}

export interface OpportunityScoreBreakdown {
  legitimacy: { ratingPoints: number; reviewVolumePoints: number; operationalPoints: number; total: number };
  digitalWeakness: { averageDigitalScore: number; points: number };
  pillars: {
    websiteScore: number | null;
    seoScore: number | null;
    mobileScore: number | null;
    conversionScore: number | null;
    technicalScore: number | null;
    contactabilityScore: number | null;
    googleProfileScore: number | null;
  };
}

export interface OpportunityScoreView {
  score: number;
  level: OpportunityLevel;
  breakdown: OpportunityScoreBreakdown;
}

export interface GrowthOpportunityView {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  evidence: string;
  recommendation: string;
}

export interface LeadSocialProfileView {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "YOUTUBE" | "TIKTOK";
  url: string;
}

export interface LeadContactView {
  id: string;
  type: "PHONE" | "EMAIL" | "WEBSITE" | "BOOKING_URL";
  value: string;
  source: "GOOGLE_PLACES" | "WEBSITE" | "MANUAL";
  verified: boolean;
  createdAt: string;
}

export interface LeadActivityView {
  id: string;
  type: string;
  metadata: unknown;
  createdAt: string;
}

export interface LeadAuditResponse {
  lead: LeadAuditSummary;
  opportunity: OpportunityScoreView | null;
  website: WebsiteAuditView | null;
  seo: SeoAuditView | null;
  conversion: ConversionAuditView;
  googleBusiness: GoogleBusinessAuditView;
  growthOpportunities: GrowthOpportunityView[];
  social: LeadSocialProfileView[];
  contacts: LeadContactView[];
  activity: LeadActivityView[];
}
