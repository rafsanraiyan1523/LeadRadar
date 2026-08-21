import { describe, expect, it } from "vitest";
import type { GoogleBusinessAuditResult } from "@lead-radar/types";
import { generateGrowthOpportunities } from "./growth-opportunities";
import { buildExtraction } from "./test-utils";

const UNVERIFIED: GoogleBusinessAuditResult = { status: "UNVERIFIED", score: null, signals: null, reason: "n/a" };

describe("generateGrowthOpportunities", () => {
  it("flags a missing website as the sole website-category finding", () => {
    const findings = generateGrowthOpportunities({
      websiteUrl: null,
      extraction: null,
      conversionScore: null,
      googleProfile: UNVERIFIED,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.title).toBe("No website detected");
    expect(findings[0]?.severity).toBe("HIGH");
  });

  it("produces no findings for a fully healthy site and profile", () => {
    const findings = generateGrowthOpportunities({
      websiteUrl: "https://example.test/",
      extraction: buildExtraction(),
      conversionScore: 100,
      googleProfile: {
        status: "FOUND",
        score: 95,
        signals: {
          displayName: "Example",
          primaryCategory: "Cafe",
          categories: [],
          rating: 4.6,
          userRatingCount: 200,
          businessStatus: "OPERATIONAL",
          phone: "+8801711111111",
          websiteUrl: "https://example.test",
          address: "123 Main St",
          openingHours: ["Mon-Sat 9-9"],
          mapsUri: "https://maps.google.com",
          photosAvailable: true,
        },
        reason: null,
      },
    });
    expect(findings).toEqual([]);
  });

  it("flags weak SEO metadata, mobile config, and content gaps together for a bare-bones site", () => {
    const extraction = buildExtraction({
      title: null,
      metaDescription: null,
      viewport: null,
      socialLinks: [],
      serviceInfo: [],
      bookingUrl: null,
      hasContactCta: false,
    });
    const findings = generateGrowthOpportunities({
      websiteUrl: "https://example.test/",
      extraction,
      conversionScore: 30,
      googleProfile: UNVERIFIED,
    });
    const titles = findings.map((f) => f.title);
    expect(titles).toContain("Missing SEO metadata");
    expect(titles).toContain("Weak mobile configuration");
    expect(titles).toContain("No social links found on website");
    expect(titles).toContain("No clear service pages");
    expect(titles).toContain("No online booking detected");
  });

  it("flags a missing Google Business Profile only when a real lookup came back empty", () => {
    const notFound = generateGrowthOpportunities({
      websiteUrl: "https://example.test/",
      extraction: buildExtraction(),
      conversionScore: 100,
      googleProfile: { status: "NOT_FOUND_IN_CURRENT_SEARCH", score: null, signals: null, reason: "not found" },
    });
    expect(notFound.map((f) => f.title)).toContain("No Google Business Profile found");

    const unverified = generateGrowthOpportunities({
      websiteUrl: "https://example.test/",
      extraction: buildExtraction(),
      conversionScore: 100,
      googleProfile: UNVERIFIED,
    });
    expect(unverified.map((f) => f.title)).not.toContain("No Google Business Profile found");
  });

  it("flags a strong rating with limited review volume", () => {
    const findings = generateGrowthOpportunities({
      websiteUrl: "https://example.test/",
      extraction: buildExtraction(),
      conversionScore: 100,
      googleProfile: {
        status: "FOUND",
        score: 60,
        signals: {
          displayName: "Example",
          primaryCategory: "Cafe",
          categories: [],
          rating: 4.9,
          userRatingCount: 4,
          businessStatus: "OPERATIONAL",
          phone: null,
          websiteUrl: null,
          address: null,
          openingHours: null,
          mapsUri: "https://maps.google.com",
          photosAvailable: null,
        },
        reason: null,
      },
    });
    expect(findings.map((f) => f.title)).toContain("Strong rating but limited review volume");
  });
});
