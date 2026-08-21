import { describe, expect, it } from "vitest";
import type { GrowthOpportunityFinding } from "@lead-radar/types";
import { mapFindingsToRecommendedServices } from "./recommended-services";

function finding(overrides: Partial<GrowthOpportunityFinding> = {}): GrowthOpportunityFinding {
  return {
    title: "No website detected",
    category: "website",
    severity: "HIGH",
    evidence: "no website on file",
    recommendation: "build one",
    ...overrides,
  };
}

describe("mapFindingsToRecommendedServices", () => {
  it("returns nothing for an empty finding list — never invents a service without evidence", () => {
    expect(mapFindingsToRecommendedServices([])).toEqual([]);
  });

  it("maps a known finding title to its service with the triggering finding recorded", () => {
    const result = mapFindingsToRecommendedServices([finding({ title: "Missing SEO metadata", category: "seo" })]);
    expect(result).toEqual([{ service: "SEO", triggeredBy: ["Missing SEO metadata"] }]);
  });

  it("merges multiple findings that recommend the same service", () => {
    const result = mapFindingsToRecommendedServices([
      finding({ title: "No website detected" }),
      finding({ title: "Weak mobile configuration", category: "mobile" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.service).toBe("WEBSITE_DEVELOPMENT");
    expect(result[0]?.triggeredBy).toEqual(
      expect.arrayContaining(["No website detected", "Weak mobile configuration"]),
    );
  });

  it("orders services by number of triggering findings, most first", () => {
    const result = mapFindingsToRecommendedServices([
      finding({ title: "No website detected" }),
      finding({ title: "Weak mobile configuration", category: "mobile" }),
      finding({ title: "No Google Business Profile found", category: "google-business" }),
    ]);
    expect(result[0]?.service).toBe("WEBSITE_DEVELOPMENT");
    expect(result[0]?.triggeredBy).toHaveLength(2);
  });

  it("never recommends ECOMMERCE or PAID_ADS — no finding currently evidences either", () => {
    const allTitles = [
      "No website detected",
      "Site is not served over HTTPS",
      "No online booking detected",
      "Weak calls-to-action",
      "Missing SEO metadata",
      "Weak mobile configuration",
      "No social links found on website",
      "No clear service pages",
      "No Google Business Profile found",
      "Strong rating but limited review volume",
    ];
    const result = mapFindingsToRecommendedServices(allTitles.map((title) => finding({ title })));
    const services = result.map((r) => r.service);
    expect(services).not.toContain("ECOMMERCE");
    expect(services).not.toContain("PAID_ADS");
  });
});
