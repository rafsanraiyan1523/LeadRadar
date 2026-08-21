import type {
  ContactabilityResult,
  ConversionAuditResult,
  GoogleBusinessAuditResult,
  GrowthOpportunityFinding,
  MobileAuditResult,
  OpportunityScoreResult,
  SeoAuditResult,
  TechnicalAuditResult,
  WebsitePerformanceSignals,
} from '@lead-radar/types';

/** The shape written into WebsiteAudit.signals by the worker's digital intelligence pipeline. */
export interface WebsiteAuditSignalsJson {
  seo: SeoAuditResult | null;
  mobile: MobileAuditResult | null;
  conversion: ConversionAuditResult | null;
  technical: TechnicalAuditResult | null;
  performance: WebsitePerformanceSignals;
  brokenLinksChecked: number;
  brokenLinksFound: number;
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
  breakdown: SeoAuditResult['breakdown'] | null;
}

export interface ConversionAuditView {
  score: number | null;
  breakdown: ConversionAuditResult['breakdown'] | null;
  contactability: ContactabilityResult;
}

export interface MobileTechnicalView {
  mobile: MobileAuditResult | null;
  technical: TechnicalAuditResult | null;
}

export type {
  GoogleBusinessAuditResult,
  OpportunityScoreResult,
  GrowthOpportunityFinding,
};
