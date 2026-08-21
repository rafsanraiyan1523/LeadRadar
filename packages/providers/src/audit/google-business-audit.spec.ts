import { describe, expect, it } from "vitest";
import type { GoogleBusinessSignals } from "@lead-radar/types";
import { buildGoogleBusinessAuditResult, computeGoogleProfileScore } from "./google-business-audit";

function signals(overrides: Partial<GoogleBusinessSignals> = {}): GoogleBusinessSignals {
  return {
    displayName: "Example Cafe",
    primaryCategory: "Cafe",
    categories: ["Cafe", "Coffee Shop"],
    rating: 4.7,
    userRatingCount: 150,
    businessStatus: "OPERATIONAL",
    phone: "+8801711111111",
    websiteUrl: "https://example.test",
    address: "123 Main St",
    openingHours: ["Mon-Sat: 9am-9pm"],
    mapsUri: "https://maps.google.com/?cid=123",
    photosAvailable: true,
    ...overrides,
  };
}

describe("computeGoogleProfileScore", () => {
  it("scores near-perfect for a strong, complete profile", () => {
    expect(computeGoogleProfileScore(signals())).toBe(100);
  });

  it("scores the floor (profile-found-only) for a minimal profile", () => {
    const score = computeGoogleProfileScore(
      signals({ rating: null, userRatingCount: null, openingHours: null, phone: null, websiteUrl: null }),
    );
    expect(score).toBe(30);
  });

  it("rewards a strong rating even with a low review count less than a high-volume, mediocre one", () => {
    const strongRatingLowVolume = computeGoogleProfileScore(signals({ rating: 4.8, userRatingCount: 3 }));
    const mediocreRatingHighVolume = computeGoogleProfileScore(signals({ rating: 3.2, userRatingCount: 200 }));
    expect(strongRatingLowVolume).toBeLessThan(mediocreRatingHighVolume);
  });
});

describe("buildGoogleBusinessAuditResult", () => {
  it("scores a FOUND profile", () => {
    const result = buildGoogleBusinessAuditResult({ status: "FOUND", signals: signals(), reason: null });
    expect(result.score).not.toBeNull();
    expect(result.status).toBe("FOUND");
  });

  it("never scores a NOT_FOUND_IN_CURRENT_SEARCH result", () => {
    const result = buildGoogleBusinessAuditResult({
      status: "NOT_FOUND_IN_CURRENT_SEARCH",
      signals: null,
      reason: "Places lookup returned no result",
    });
    expect(result.score).toBeNull();
  });

  it("never scores an UNVERIFIED result", () => {
    const result = buildGoogleBusinessAuditResult({
      status: "UNVERIFIED",
      signals: null,
      reason: "No Google identifier on file for this lead",
    });
    expect(result.score).toBeNull();
    expect(result.status).toBe("UNVERIFIED");
  });
});
