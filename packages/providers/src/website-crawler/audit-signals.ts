import type { AccessibilitySignals, WebsiteExtraction } from "@lead-radar/types";

// Weights sum to 100 — every point is tied to something the crawler actually observed.
export function computeSeoScore(extraction: WebsiteExtraction): number {
  let score = 0;
  if (extraction.title) score += 20;
  if (extraction.metaDescription) score += 20;
  if (extraction.h1) score += 15;
  if (extraction.canonical) score += 15;
  if (extraction.viewport) score += 10;
  if (extraction.sitemapUrl) score += 10;
  if (Object.keys(extraction.openGraph).length > 0) score += 10;
  return Math.min(100, score);
}

export function computeAccessibilityScore(signals: AccessibilitySignals): number {
  let score = 100;
  if (signals.totalImages > 0) {
    const missingRatio = signals.imagesWithoutAlt / signals.totalImages;
    score -= Math.round(missingRatio * 40);
  }
  if (!signals.hasLangAttribute) score -= 20;
  if (!signals.headingHierarchyOk) score -= 20;
  if (!signals.hasViewportMeta) score -= 20;
  return Math.max(0, Math.min(100, score));
}

/** Human-readable issue strings for WebsiteAudit.issues — every line traces to a real, observed signal. */
export function buildAuditIssues(extraction: WebsiteExtraction): string[] {
  const issues: string[] = [];
  if (!extraction.title) issues.push("Missing page title");
  if (!extraction.metaDescription) issues.push("Missing meta description");
  if (!extraction.h1) issues.push("Missing H1 heading");
  if (!extraction.canonical) issues.push("No canonical URL set");
  if (!extraction.viewport) issues.push("No responsive viewport meta tag");
  if (!extraction.https) issues.push("Site is not served over HTTPS");
  if (!extraction.accessibility.hasLangAttribute) issues.push("Missing <html lang> attribute");
  if (!extraction.accessibility.headingHierarchyOk) issues.push("Heading levels skip (e.g. H1 straight to H4)");
  if (extraction.accessibility.imagesWithoutAlt > 0) {
    issues.push(
      `${extraction.accessibility.imagesWithoutAlt} of ${extraction.accessibility.totalImages} images missing alt text`,
    );
  }
  if (extraction.emails.length === 0) issues.push("No email address found on the site");
  if (extraction.phones.length === 0) issues.push("No phone number found on the site");
  if (extraction.socialLinks.length === 0) issues.push("No social media links found on the site");
  return issues;
}
