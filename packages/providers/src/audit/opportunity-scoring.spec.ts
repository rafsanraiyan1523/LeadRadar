import { describe, expect, it } from "vitest";
import type { GoogleBusinessAuditResult } from "@lead-radar/types";
import { computeOpportunityScore, getOpportunityLevel, type OpportunityScoringInput } from "./opportunity-scoring";

const UNVERIFIED: GoogleBusinessAuditResult = { status: "UNVERIFIED", score: null, signals: null, reason: "n/a" };

function google(overrides: Partial<NonNullable<GoogleBusinessAuditResult["signals"]>> = {}): GoogleBusinessAuditResult {
  return {
    status: "FOUND",
    score: 80,
    signals: {
      displayName: "Example",
      primaryCategory: "Business",
      categories: [],
      rating: 4.6,
      userRatingCount: 150,
      businessStatus: "OPERATIONAL",
      phone: "+8801711111111",
      websiteUrl: null,
      address: "123 Main St",
      openingHours: ["Mon-Sat 9-9"],
      mapsUri: "https://maps.google.com",
      photosAvailable: true,
      ...overrides,
    },
    reason: null,
  };
}

const NO_WEBSITE: OpportunityScoringInput = {
  websiteScore: null,
  seoScore: null,
  mobileScore: null,
  conversionScore: null,
  technicalScore: null,
  contactabilityScore: 20,
  googleProfile: google(),
};

const EXCELLENT_DIGITAL_PRESENCE: OpportunityScoringInput = {
  websiteScore: 98,
  seoScore: 100,
  mobileScore: 100,
  conversionScore: 100,
  technicalScore: 95,
  contactabilityScore: 90,
  googleProfile: google(),
};

describe("computeOpportunityScore", () => {
  it("scores an established business with no website as HIGH opportunity", () => {
    const result = computeOpportunityScore(NO_WEBSITE);
    expect(result.level).toBe("HIGH");
    expect(result.score).toBeGreaterThanOrEqual(66);
  });

  it("scores a business with excellent digital presence lower than the same business with no website", () => {
    const noWebsite = computeOpportunityScore(NO_WEBSITE);
    const excellent = computeOpportunityScore(EXCELLENT_DIGITAL_PRESENCE);
    expect(excellent.score).toBeLessThan(noWebsite.score);
    expect(excellent.level).not.toBe("HIGH");
  });

  it("scores a poor, weak website higher than a strong, excellent website", () => {
    const poorWebsite = computeOpportunityScore({
      websiteScore: 20,
      seoScore: 10,
      mobileScore: 0,
      conversionScore: 10,
      technicalScore: 40,
      contactabilityScore: 20,
      googleProfile: UNVERIFIED,
    });
    const excellent = computeOpportunityScore(EXCELLENT_DIGITAL_PRESENCE);
    expect(poorWebsite.score).toBeGreaterThan(excellent.score);
  });

  it("only awards legitimacy points for a verified (FOUND) Google profile", () => {
    const strongButUnverified = computeOpportunityScore({ ...NO_WEBSITE, googleProfile: UNVERIFIED });
    const strongVerified = computeOpportunityScore(NO_WEBSITE);
    expect(strongVerified.breakdown.legitimacy.total).toBeGreaterThan(0);
    expect(strongButUnverified.breakdown.legitimacy.total).toBe(0);
    expect(strongVerified.score).toBeGreaterThan(strongButUnverified.score);
  });

  it("increases the opportunity score as contactability weakens, all else equal", () => {
    const weakContactability = computeOpportunityScore({ ...EXCELLENT_DIGITAL_PRESENCE, contactabilityScore: 10 });
    const strongContactability = computeOpportunityScore({ ...EXCELLENT_DIGITAL_PRESENCE, contactabilityScore: 90 });
    expect(weakContactability.score).toBeGreaterThan(strongContactability.score);
  });

  it("produces a mid-range score for a business with mixed strong/weak signals", () => {
    const mixed = computeOpportunityScore({
      websiteScore: 60,
      seoScore: 40,
      mobileScore: 80,
      conversionScore: 30,
      technicalScore: 70,
      contactabilityScore: 50,
      googleProfile: google({ rating: 3.6, userRatingCount: 12 }),
    });
    expect(mixed.level).toBe("MEDIUM");
  });

  it("is fully deterministic for identical input", () => {
    const a = computeOpportunityScore(NO_WEBSITE);
    const b = computeOpportunityScore(NO_WEBSITE);
    expect(a).toEqual(b);
  });

  it("never produces a score outside 0-100", () => {
    const min = computeOpportunityScore({
      websiteScore: 100,
      seoScore: 100,
      mobileScore: 100,
      conversionScore: 100,
      technicalScore: 100,
      contactabilityScore: 100,
      googleProfile: UNVERIFIED,
    });
    const max = computeOpportunityScore({
      websiteScore: null,
      seoScore: null,
      mobileScore: null,
      conversionScore: null,
      technicalScore: null,
      contactabilityScore: null,
      googleProfile: google({ rating: 5, userRatingCount: 1000 }),
    });
    expect(min.score).toBeGreaterThanOrEqual(0);
    expect(max.score).toBeLessThanOrEqual(100);
  });
});

describe("getOpportunityLevel", () => {
  it.each([
    [0, "LOW"],
    [32, "LOW"],
    [33, "MEDIUM"],
    [65, "MEDIUM"],
    [66, "HIGH"],
    [100, "HIGH"],
  ] as const)("maps score %i to %s", (score, level) => {
    expect(getOpportunityLevel(score)).toBe(level);
  });
});
