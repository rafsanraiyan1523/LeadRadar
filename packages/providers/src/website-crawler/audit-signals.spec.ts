import { describe, expect, it } from "vitest";
import { buildAuditIssues, computeAccessibilityScore, computeSeoScore } from "./audit-signals";
import type { WebsiteExtraction } from "@lead-radar/types";

const FULL_EXTRACTION: WebsiteExtraction = {
  startUrl: "https://example.test/",
  https: true,
  emails: ["hello@example.test"],
  phones: ["+8801711111111"],
  socialLinks: [{ platform: "FACEBOOK", url: "https://facebook.com/example" }],
  contactUrl: "https://example.test/contact",
  bookingUrl: null,
  hasContactCta: true,
  title: "Example",
  metaDescription: "An example business",
  h1: "Welcome",
  headings: ["Welcome"],
  canonical: "https://example.test/",
  robotsMeta: "index, follow",
  sitemapUrl: "https://example.test/sitemap.xml",
  openGraph: { "og:title": "Example" },
  structuredData: [],
  viewport: "width=device-width",
  serviceInfo: [],
  accessibility: {
    totalImages: 4,
    imagesWithoutAlt: 0,
    hasLangAttribute: true,
    headingHierarchyOk: true,
    hasViewportMeta: true,
  },
  technologies: [],
  pagesCrawled: ["https://example.test/"],
  robotsTxtRespected: true,
  performance: { homepageResponseTimeMs: 120, homepageSizeBytes: 4096 },
  brokenLinksChecked: 0,
  brokenLinksFound: 0,
};

describe("computeSeoScore", () => {
  it("scores 100 when every SEO signal is present", () => {
    expect(computeSeoScore(FULL_EXTRACTION)).toBe(100);
  });

  it("scores 0 when nothing is present", () => {
    const empty: WebsiteExtraction = {
      ...FULL_EXTRACTION,
      title: null,
      metaDescription: null,
      h1: null,
      canonical: null,
      viewport: null,
      sitemapUrl: null,
      openGraph: {},
    };
    expect(computeSeoScore(empty)).toBe(0);
  });
});

describe("computeAccessibilityScore", () => {
  it("scores 100 when all signals are healthy", () => {
    expect(computeAccessibilityScore(FULL_EXTRACTION.accessibility)).toBe(100);
  });

  it("penalizes missing alt text proportionally", () => {
    const score = computeAccessibilityScore({
      totalImages: 10,
      imagesWithoutAlt: 5,
      hasLangAttribute: true,
      headingHierarchyOk: true,
      hasViewportMeta: true,
    });
    expect(score).toBe(80); // 50% missing alt -> -20 (40 * 0.5)
  });

  it("never goes below 0", () => {
    const score = computeAccessibilityScore({
      totalImages: 10,
      imagesWithoutAlt: 10,
      hasLangAttribute: false,
      headingHierarchyOk: false,
      hasViewportMeta: false,
    });
    expect(score).toBe(0);
  });
});

describe("buildAuditIssues", () => {
  it("reports no issues for a fully healthy site", () => {
    expect(buildAuditIssues(FULL_EXTRACTION)).toEqual([]);
  });

  it("reports specific, traceable issues for a weak site", () => {
    const weak: WebsiteExtraction = {
      ...FULL_EXTRACTION,
      https: false,
      title: null,
      emails: [],
      phones: [],
      socialLinks: [],
    };
    const issues = buildAuditIssues(weak);
    expect(issues).toContain("Missing page title");
    expect(issues).toContain("Site is not served over HTTPS");
    expect(issues).toContain("No email address found on the site");
    expect(issues).toContain("No phone number found on the site");
    expect(issues).toContain("No social media links found on the site");
  });
});
