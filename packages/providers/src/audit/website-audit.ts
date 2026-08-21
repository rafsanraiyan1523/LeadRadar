import type {
  MobileAuditBreakdown,
  MobileAuditResult,
  TechnicalAuditBreakdown,
  TechnicalAuditResult,
  WebsiteAuditResult,
  WebsiteExtraction,
} from "@lead-radar/types";
import { computeAccessibilityScore, buildAuditIssues } from "../website-crawler/audit-signals";
import { computeSeoAudit } from "./seo-audit";
import { computeConversionAudit } from "./conversion-audit";

// Weights sum to exactly 100. LeadRadar checks basic responsive
// configuration only — this is never a substitute for a real device lab.
const MOBILE_WEIGHTS: Record<keyof MobileAuditBreakdown, number> = {
  hasViewportMeta: 60,
  viewportConfiguredForDevice: 40,
};

export function computeMobileAudit(extraction: WebsiteExtraction): MobileAuditResult {
  const breakdown: MobileAuditBreakdown = {
    hasViewportMeta: !!extraction.viewport,
    viewportConfiguredForDevice: !!extraction.viewport?.toLowerCase().includes("width=device-width"),
  };
  let score = 0;
  for (const key of Object.keys(MOBILE_WEIGHTS) as (keyof MobileAuditBreakdown)[]) {
    if (breakdown[key]) score += MOBILE_WEIGHTS[key];
  }
  return { score, breakdown };
}

// Weights sum to exactly 100.
const TECHNICAL_WEIGHTS: Record<keyof TechnicalAuditBreakdown, number> = {
  https: 30,
  hasCanonical: 15,
  hasSitemap: 15,
  hasStructuredData: 15,
  noBrokenLinksDetected: 15,
  techStackDetected: 10,
};

export function computeTechnicalAudit(extraction: WebsiteExtraction): TechnicalAuditResult {
  const breakdown: TechnicalAuditBreakdown = {
    https: extraction.https,
    hasCanonical: !!extraction.canonical,
    hasSitemap: !!extraction.sitemapUrl,
    hasStructuredData: extraction.structuredData.length > 0,
    // No links checked yet is treated as "clean" — we only flag what we actually found broken.
    noBrokenLinksDetected: extraction.brokenLinksFound === 0,
    techStackDetected: extraction.technologies.length > 0,
  };
  let score = 0;
  for (const key of Object.keys(TECHNICAL_WEIGHTS) as (keyof TechnicalAuditBreakdown)[]) {
    if (breakdown[key]) score += TECHNICAL_WEIGHTS[key];
  }
  return { score, breakdown };
}

/**
 * WebsiteAuditService's core engine: runs the SEO, mobile, conversion, and
 * technical checks over a single crawl and rolls them into one overall
 * Website Score (their equal-weighted average). `extraction === null` means
 * no website was found at all — every sub-score is `null` ("not
 * applicable"), never a fabricated 0.
 */
export function computeWebsiteAudit(extraction: WebsiteExtraction | null): WebsiteAuditResult {
  if (!extraction) {
    return {
      websiteScore: null,
      seo: null,
      mobile: null,
      conversion: null,
      technical: null,
      accessibilityScore: null,
      issues: [],
    };
  }

  const seo = computeSeoAudit(extraction);
  const mobile = computeMobileAudit(extraction);
  const conversion = computeConversionAudit(extraction);
  const technical = computeTechnicalAudit(extraction);
  const accessibilityScore = computeAccessibilityScore(extraction.accessibility);

  const websiteScore = Math.round(
    (seo.score + mobile.score + conversion.score + technical.score + accessibilityScore) / 5,
  );

  return {
    websiteScore,
    seo,
    mobile,
    conversion,
    technical,
    accessibilityScore,
    issues: buildAuditIssues(extraction),
  };
}
