/**
 * Types for the Digital Intelligence Engine — the audit/scoring pipeline that
 * turns crawled-website + Google Business signals into explainable scores
 * and growth-opportunity findings. Every number here traces back to a real,
 * observed signal (see @lead-radar/providers/audit) — nothing is fabricated.
 */

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

export interface SeoAuditBreakdown {
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasH1: boolean;
  hasCanonical: boolean;
  hasViewport: boolean;
  hasSitemap: boolean;
  hasStructuredData: boolean;
  hasOpenGraph: boolean;
  notBlockedByRobots: boolean;
}

export interface SeoAuditResult {
  score: number;
  breakdown: SeoAuditBreakdown;
}

export interface ConversionAuditBreakdown {
  hasContactCta: boolean;
  phoneVisible: boolean;
  emailVisible: boolean;
  hasBookingCta: boolean;
  hasContactPage: boolean;
  hasServicePages: boolean;
}

export interface ConversionAuditResult {
  score: number;
  breakdown: ConversionAuditBreakdown;
}

export interface MobileAuditBreakdown {
  hasViewportMeta: boolean;
  viewportConfiguredForDevice: boolean;
}

export interface MobileAuditResult {
  score: number;
  breakdown: MobileAuditBreakdown;
}

export interface TechnicalAuditBreakdown {
  https: boolean;
  hasCanonical: boolean;
  hasSitemap: boolean;
  hasStructuredData: boolean;
  noBrokenLinksDetected: boolean;
  techStackDetected: boolean;
}

export interface TechnicalAuditResult {
  score: number;
  breakdown: TechnicalAuditBreakdown;
}

/** The full WebsiteAuditService output for one crawl — null sub-scores mean "not applicable" (e.g. no website), never a fabricated 0. */
export interface WebsiteAuditResult {
  websiteScore: number | null;
  seo: SeoAuditResult | null;
  mobile: MobileAuditResult | null;
  conversion: ConversionAuditResult | null;
  technical: TechnicalAuditResult | null;
  accessibilityScore: number | null;
  issues: string[];
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

export interface GoogleBusinessAuditResult {
  status: GoogleProfileStatus;
  /** null whenever status isn't FOUND — an unverified/absent profile is never scored. */
  score: number | null;
  signals: GoogleBusinessSignals | null;
  reason: string | null;
}

export interface OpportunityScoreBreakdown {
  legitimacy: {
    ratingPoints: number;
    reviewVolumePoints: number;
    operationalPoints: number;
    total: number;
  };
  digitalWeakness: {
    averageDigitalScore: number;
    points: number;
  };
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

export interface OpportunityScoreResult {
  score: number;
  level: OpportunityLevel;
  breakdown: OpportunityScoreBreakdown;
}

export interface GrowthOpportunityFinding {
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  evidence: string;
  recommendation: string;
}
