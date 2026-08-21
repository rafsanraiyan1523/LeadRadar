import { afterEach, describe, expect, it, vi } from "vitest";
import { GooglePlacesProvider } from "./google-places.provider";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("GooglePlacesProvider", () => {
  it("requires an API key", () => {
    expect(() => new GooglePlacesProvider({ apiKey: "" })).toThrow();
  });

  it("requests only the configured field mask and normalizes a successful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "places/abc123",
              displayName: { text: "Test Dental Clinic" },
              formattedAddress: "12 Road 5, Banani, Dhaka, Bangladesh",
              location: { latitude: 23.79, longitude: 90.4 },
              rating: 4.5,
              userRatingCount: 120,
              businessStatus: "OPERATIONAL",
              websiteUri: "https://example.com",
              nationalPhoneNumber: "+8801712345678",
              primaryTypeDisplayName: { text: "Dental Clinic" },
              googleMapsUri: "https://maps.google.com/?cid=123",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const provider = new GooglePlacesProvider({ apiKey: "test-key" });
    const results = await provider.searchBusinesses({
      query: "Dental Clinic",
      location: "Banani, Dhaka",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      externalId: "places/abc123",
      name: "Test Dental Clinic",
      rating: 4.5,
      reviewCount: 120,
      googleMapsUri: "https://maps.google.com/?cid=123",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(headers["X-Goog-FieldMask"]).toContain("places.id");
    expect(headers["X-Goog-FieldMask"]).not.toContain("reviews"); // never request more than needed
  });

  it("surfaces a clear error on provider failure (non-2xx response)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("Quota exceeded", { status: 429 }),
      ) as unknown as typeof fetch;

    const provider = new GooglePlacesProvider({ apiKey: "test-key" });

    await expect(
      provider.searchBusinesses({ query: "Cafe", location: "Gulshan, Dhaka" }),
    ).rejects.toThrow(/429/);
  });

  it("times out cleanly instead of hanging forever", async () => {
    globalThis.fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }),
    ) as unknown as typeof fetch;

    const provider = new GooglePlacesProvider({ apiKey: "test-key", requestTimeoutMs: 20 });

    await expect(
      provider.searchBusinesses({ query: "Hotel", location: "Uttara, Dhaka" }),
    ).rejects.toThrow(/timed out/i);
  });

  it("returns null (not an error) when a place id is not found", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("Not found", { status: 404 })) as unknown as typeof fetch;

    const provider = new GooglePlacesProvider({ apiKey: "test-key" });
    await expect(provider.getBusinessDetails("places/does-not-exist")).resolves.toBeNull();
  });
});
