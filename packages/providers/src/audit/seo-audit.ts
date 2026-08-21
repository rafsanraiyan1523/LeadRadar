import type { SeoAuditBreakdown, SeoAuditResult, WebsiteExtraction } from "@lead-radar/types";

// Weights sum to exactly 100 — every point traces to a signal the crawler actually observed.
const WEIGHTS: Record<keyof SeoAuditBreakdown, number> = {
  hasTitle: 15,
  hasMetaDescription: 15,
  hasH1: 10,
  hasCanonical: 10,
  hasViewport: 10,
  hasSitemap: 10,
  hasStructuredData: 10,
  hasOpenGraph: 10,
  notBlockedByRobots: 10,
};

/** Computes the SEO Score (0-100) from what LeadRadar's own crawl observed — never a third-party SEO tool's data. */
export function computeSeoAudit(extraction: WebsiteExtraction): SeoAuditResult {
  const breakdown: SeoAuditBreakdown = {
    hasTitle: !!extraction.title,
    hasMetaDescription: !!extraction.metaDescription,
    hasH1: !!extraction.h1,
    hasCanonical: !!extraction.canonical,
    hasViewport: !!extraction.viewport,
    hasSitemap: !!extraction.sitemapUrl,
    hasStructuredData: extraction.structuredData.length > 0,
    hasOpenGraph: Object.keys(extraction.openGraph).length > 0,
    notBlockedByRobots: !extraction.robotsMeta?.toLowerCase().includes("noindex"),
  };

  let score = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof SeoAuditBreakdown)[]) {
    if (breakdown[key]) score += WEIGHTS[key];
  }

  return { score, breakdown };
}
