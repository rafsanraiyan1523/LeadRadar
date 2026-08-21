import { describe, expect, it } from "vitest";
import { computeMobileAudit, computeTechnicalAudit, computeWebsiteAudit } from "./website-audit";
import { buildExtraction } from "./test-utils";

describe("computeMobileAudit", () => {
  it("scores 100 for a well-configured responsive viewport", () => {
    expect(computeMobileAudit(buildExtraction()).score).toBe(100);
  });

  it("scores 0 with no viewport meta tag at all", () => {
    expect(computeMobileAudit(buildExtraction({ viewport: null })).score).toBe(0);
  });

  it("partially credits a viewport tag that isn't device-width configured", () => {
    const result = computeMobileAudit(buildExtraction({ viewport: "width=1024" }));
    expect(result.breakdown.hasViewportMeta).toBe(true);
    expect(result.breakdown.viewportConfiguredForDevice).toBe(false);
    expect(result.score).toBe(60);
  });
});

describe("computeTechnicalAudit", () => {
  it("scores 100 when every technical signal is healthy", () => {
    expect(computeTechnicalAudit(buildExtraction()).score).toBe(100);
  });

  it("penalizes a detected broken priority link", () => {
    const result = computeTechnicalAudit(buildExtraction({ brokenLinksChecked: 2, brokenLinksFound: 1 }));
    expect(result.breakdown.noBrokenLinksDetected).toBe(false);
    expect(result.score).toBe(85);
  });

  it("penalizes an insecure (non-HTTPS) site", () => {
    expect(computeTechnicalAudit(buildExtraction({ https: false })).score).toBe(70);
  });
});

describe("computeWebsiteAudit", () => {
  it("returns an all-null result when no website was crawled", () => {
    const result = computeWebsiteAudit(null);
    expect(result.websiteScore).toBeNull();
    expect(result.seo).toBeNull();
    expect(result.issues).toEqual([]);
  });

  it("rolls up seo/mobile/conversion/technical/accessibility into one website score", () => {
    const result = computeWebsiteAudit(buildExtraction());
    expect(result.websiteScore).toBe(100);
    expect(result.seo?.score).toBe(100);
    expect(result.mobile?.score).toBe(100);
  });

  it("produces a lower website score for a weak site", () => {
    const weak = buildExtraction({
      https: false,
      title: null,
      metaDescription: null,
      viewport: null,
      hasContactCta: false,
      phones: [],
      emails: [],
      bookingUrl: null,
      contactUrl: null,
      serviceInfo: [],
    });
    const result = computeWebsiteAudit(weak);
    expect(result.websiteScore).not.toBeNull();
    expect(result.websiteScore as number).toBeLessThan(50);
  });
});
