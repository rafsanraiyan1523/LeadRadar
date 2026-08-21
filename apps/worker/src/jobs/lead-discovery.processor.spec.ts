import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { LeadDiscoveryJobData } from "@lead-radar/types";
import { createLeadDiscoveryProcessor } from "./lead-discovery.processor";

const searchBusinesses = vi.fn();

vi.mock("@lead-radar/providers", () => ({
  createLeadDiscoveryProvider: () => ({
    mode: "MOCK",
    searchBusinesses,
    getBusinessDetails: vi.fn(),
  }),
}));

function makeJob(
  data: LeadDiscoveryJobData,
): Job<LeadDiscoveryJobData> & { updateProgress: ReturnType<typeof vi.fn> } {
  return { data, updateProgress: vi.fn() } as unknown as Job<LeadDiscoveryJobData> & {
    updateProgress: ReturnType<typeof vi.fn>;
  };
}

function makePrisma() {
  return {
    search: { update: vi.fn() },
    searchResult: { createMany: vi.fn() },
  };
}

const baseJobData: LeadDiscoveryJobData = {
  searchId: "search-1",
  organizationId: "org-1",
  query: "Cafe",
  location: "Gulshan, Dhaka",
  maxResults: 5,
  providerMode: "MOCK",
};

describe("lead discovery processor", () => {
  beforeEach(() => {
    searchBusinesses.mockReset();
  });

  it("processes a mock search: marks RUNNING, persists normalized results, marks COMPLETED", async () => {
    const businesses = Array.from({ length: 5 }, (_, i) => ({
      externalId: `mock:${i}`,
      name: `Business ${i}`,
      category: "Cafe",
      address: "123 Road",
      city: "Dhaka",
      country: "Bangladesh",
      location: { latitude: 23.79, longitude: 90.4 },
      rating: 4.2,
      reviewCount: 50,
      businessStatus: "OPERATIONAL" as const,
      websiteUrl: null,
      phone: null,
      googleMapsUri: "https://www.google.com/maps/search/?api=1&query=x",
      hasGoogleProfile: true,
    }));
    searchBusinesses.mockResolvedValue(businesses);

    const prisma = makePrisma();
    const job = makeJob(baseJobData);

    const result = await createLeadDiscoveryProcessor(prisma)(job);

    expect(result).toEqual({ resultCount: 5 });
    expect(prisma.search.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: { status: "RUNNING", progress: 10 },
    });
    expect(prisma.searchResult.createMany).toHaveBeenCalledTimes(1);
    const created = prisma.searchResult.createMany.mock.calls[0]![0].data;
    expect(created).toHaveLength(5);
    expect(created[0]).toMatchObject({
      searchId: "search-1",
      businessName: "Business 0",
      hasWebsite: false,
    });

    const finalUpdate = prisma.search.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({ status: "COMPLETED", progress: 100, resultCount: 5 });
    expect(job.updateProgress).toHaveBeenCalledWith(10);
    expect(job.updateProgress).toHaveBeenCalledWith(60);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it("marks the search FAILED and rethrows when the provider errors out", async () => {
    searchBusinesses.mockRejectedValue(new Error("Google Places API error 500"));

    const prisma = makePrisma();
    const job = makeJob(baseJobData);

    await expect(createLeadDiscoveryProcessor(prisma)(job)).rejects.toThrow(
      "Google Places API error 500",
    );

    const finalUpdate = prisma.search.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({
      status: "FAILED",
      errorMessage: "Google Places API error 500",
    });
    expect(prisma.searchResult.createMany).not.toHaveBeenCalled();
  });

  it("marks the search FAILED on a provider timeout, same as any other provider failure", async () => {
    searchBusinesses.mockRejectedValue(
      new Error("Google Places API request timed out after 8000ms"),
    );

    const prisma = makePrisma();
    const job = makeJob(baseJobData);

    await expect(createLeadDiscoveryProcessor(prisma)(job)).rejects.toThrow(/timed out/);
    const finalUpdate = prisma.search.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe("FAILED");
  });

  it("completes successfully with zero results — that's not a failure", async () => {
    searchBusinesses.mockResolvedValue([]);

    const prisma = makePrisma();
    const job = makeJob({ ...baseJobData, maxResults: 0 });

    const result = await createLeadDiscoveryProcessor(prisma)(job);

    expect(result).toEqual({ resultCount: 0 });
    expect(prisma.searchResult.createMany).not.toHaveBeenCalled();
    const finalUpdate = prisma.search.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({ status: "COMPLETED", resultCount: 0 });
  });
});
