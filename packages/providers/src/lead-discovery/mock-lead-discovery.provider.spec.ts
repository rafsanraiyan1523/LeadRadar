import { describe, expect, it } from "vitest";
import { MockLeadDiscoveryProvider } from "./mock-lead-discovery.provider";

const provider = new MockLeadDiscoveryProvider({ simulateLatency: false });

describe("MockLeadDiscoveryProvider", () => {
  it("generates the requested number of realistic businesses for a known category/location", async () => {
    const results = await provider.searchBusinesses({
      query: "Dental Clinic",
      location: "Banani, Dhaka",
      maxResults: 12,
    });

    expect(results).toHaveLength(12);
    for (const business of results) {
      expect(business.name.length).toBeGreaterThan(0);
      expect(business.category).toBe("Dental Clinic");
      expect(business.city).toBe("Dhaka");
      expect(business.country).toBe("Bangladesh");
      expect(business.address).toContain("Banani");
      expect(business.location.latitude).toBeGreaterThan(23);
      expect(business.location.longitude).toBeGreaterThan(90);
      expect(business.googleMapsUri).toMatch(/^https:\/\/www\.google\.com\/maps\/search/);
      expect(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]).toContain(
        business.businessStatus,
      );
    }
  });

  it("never fabricates a website or phone number — both can legitimately be null", async () => {
    const results = await provider.searchBusinesses({
      query: "Cafe",
      location: "Gulshan, Dhaka",
      maxResults: 40,
    });

    // Some businesses should have neither, given the mock's ~55%/~85% presence rates.
    expect(results.some((b) => b.websiteUrl === null)).toBe(true);
    expect(results.some((b) => b.phone === null)).toBe(true);
    for (const business of results) {
      if (business.websiteUrl) {
        expect(() => new URL(business.websiteUrl!)).not.toThrow();
      }
      if (business.phone) {
        expect(business.phone).toMatch(/^\+880\d{10}$/);
      }
    }
  });

  it("leaves rating/reviewCount null when there is no Google profile — never invents them", async () => {
    const results = await provider.searchBusinesses({
      query: "Gym",
      location: "Dhanmondi, Dhaka",
      maxResults: 40,
    });

    const withoutProfile = results.filter((b) => !b.hasGoogleProfile);
    expect(withoutProfile.length).toBeGreaterThan(0);
    for (const business of withoutProfile) {
      expect(business.rating).toBeNull();
      expect(business.reviewCount).toBeNull();
    }
  });

  it("is deterministic: the same query+location+index always yields the same business", async () => {
    const first = await provider.searchBusinesses({
      query: "Hotel",
      location: "Uttara, Dhaka",
      maxResults: 5,
    });
    const second = await provider.searchBusinesses({
      query: "Hotel",
      location: "Uttara, Dhaka",
      maxResults: 5,
    });

    expect(first).toEqual(second);
  });

  it("produces different businesses for different search parameters", async () => {
    const a = await provider.searchBusinesses({
      query: "Hotel",
      location: "Uttara, Dhaka",
      maxResults: 1,
    });
    const b = await provider.searchBusinesses({
      query: "Restaurant",
      location: "Uttara, Dhaka",
      maxResults: 1,
    });

    expect(a[0]!.name).not.toEqual(b[0]!.name);
  });

  it("returns an empty array — not an error — when zero results are requested", async () => {
    const results = await provider.searchBusinesses({
      query: "Salon",
      location: "Banani, Dhaka",
      maxResults: 0,
    });
    expect(results).toEqual([]);
  });

  it("handles a free-text query with no known category template gracefully", async () => {
    const results = await provider.searchBusinesses({
      query: "Pet Grooming",
      location: "Somewhere Unlisted, Chittagong",
      maxResults: 3,
    });

    expect(results).toHaveLength(3);
    expect(results[0]!.category).toBe("Pet Grooming");
  });

  it("round-trips a search result's id through getBusinessDetails", async () => {
    const [business] = await provider.searchBusinesses({
      query: "Beauty Salon",
      location: "Banani, Dhaka",
      maxResults: 1,
    });

    const details = await provider.getBusinessDetails(business!.externalId);

    expect(details).not.toBeNull();
    expect(details?.name).toBe(business!.name);
    expect(details?.address).toBe(business!.address);
  });

  it("returns null from getBusinessDetails for an id it didn't issue", async () => {
    const details = await provider.getBusinessDetails("not-a-real-id");
    expect(details).toBeNull();
  });
});
