import type { GoogleBusinessAuditResult, GrowthOpportunityFinding, WebsiteExtraction } from "@lead-radar/types";

export interface GrowthOpportunityInput {
  websiteUrl: string | null;
  extraction: WebsiteExtraction | null;
  conversionScore: number | null;
  googleProfile: GoogleBusinessAuditResult;
}

/**
 * GrowthOpportunityService: turns audit signals into structured, evidence-backed
 * findings. Every finding here is gated on a real observed signal — nothing
 * is emitted speculatively, and a signal we never checked (e.g. no website
 * to crawl) never produces a website-content finding.
 */
export function generateGrowthOpportunities(input: GrowthOpportunityInput): GrowthOpportunityFinding[] {
  const findings: GrowthOpportunityFinding[] = [];
  const { extraction, googleProfile } = input;

  if (!input.websiteUrl) {
    findings.push({
      title: "No website detected",
      category: "website",
      severity: "HIGH",
      evidence: "No website URL is on file for this business.",
      recommendation: "Build a professional website — this is the single biggest gap to close first.",
    });
  }

  if (extraction) {
    if (!extraction.https) {
      findings.push({
        title: "Site is not served over HTTPS",
        category: "technical",
        severity: "HIGH",
        evidence: `${extraction.startUrl} was reached without a valid HTTPS connection.`,
        recommendation: "Move the site to HTTPS — browsers actively warn visitors away from unencrypted sites.",
      });
    }

    if (!extraction.bookingUrl && !extraction.hasContactCta) {
      findings.push({
        title: "No online booking detected",
        category: "conversion",
        severity: "MEDIUM",
        evidence: "No booking link or scheduling call-to-action was found on the crawled pages.",
        recommendation: "Add an online booking or scheduling tool so visitors can convert without calling in.",
      });
    }

    if (input.conversionScore !== null && input.conversionScore < 50) {
      findings.push({
        title: "Weak calls-to-action",
        category: "conversion",
        severity: "MEDIUM",
        evidence: `Conversion score is ${input.conversionScore}/100 — contact/booking paths are hard to find.`,
        recommendation: "Add a clear, prominent phone/email/booking CTA above the fold on every page.",
      });
    }

    if (!extraction.title || !extraction.metaDescription) {
      findings.push({
        title: "Missing SEO metadata",
        category: "seo",
        severity: "HIGH",
        evidence: [
          !extraction.title ? "no <title> tag" : null,
          !extraction.metaDescription ? "no meta description" : null,
        ]
          .filter(Boolean)
          .join(" and "),
        recommendation: "Add a descriptive page title and meta description so search engines and social shares represent the business correctly.",
      });
    }

    if (!extraction.viewport) {
      findings.push({
        title: "Weak mobile configuration",
        category: "mobile",
        severity: "MEDIUM",
        evidence: "No responsive viewport meta tag was found — the site likely doesn't adapt to phone screens.",
        recommendation: "Add a responsive viewport meta tag and verify the layout on mobile devices.",
      });
    }

    if (extraction.socialLinks.length === 0) {
      findings.push({
        title: "No social links found on website",
        category: "social",
        severity: "LOW",
        evidence: "No Facebook, Instagram, LinkedIn, YouTube, or TikTok links were found on the crawled pages.",
        recommendation: "Link active social profiles from the site to build trust and cross-channel reach.",
      });
    }

    if (extraction.serviceInfo.length === 0) {
      findings.push({
        title: "No clear service pages",
        category: "content",
        severity: "MEDIUM",
        evidence: "The crawl found no dedicated section listing services or offerings.",
        recommendation: "Add a clear services/offerings section so visitors and search engines understand what the business does.",
      });
    }
  }

  if (googleProfile.status === "NOT_FOUND_IN_CURRENT_SEARCH") {
    findings.push({
      title: "No Google Business Profile found",
      category: "google-business",
      severity: "HIGH",
      evidence: "A live Google Business lookup for this business returned no result.",
      recommendation: "Claim and set up a Google Business Profile — it's free and drives local search visibility.",
    });
  }

  if (googleProfile.status === "FOUND" && googleProfile.signals) {
    const { rating, userRatingCount } = googleProfile.signals;
    if (rating !== null && rating >= 4.3 && userRatingCount !== null && userRatingCount < 10) {
      findings.push({
        title: "Strong rating but limited review volume",
        category: "google-business",
        severity: "LOW",
        evidence: `${rating.toFixed(1)} rating from only ${userRatingCount} review(s).`,
        recommendation: "Run a review-generation campaign to convert the strong rating into a larger, more persuasive review count.",
      });
    }
  }

  return findings;
}
