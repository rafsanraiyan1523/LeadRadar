import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import type { LeadEnrichmentJobData, WebsiteExtraction } from "@lead-radar/types";
import { MockLeadDiscoveryProvider } from "@lead-radar/providers";
import { createLeadEnrichmentProcessor } from "./lead-enrichment.processor";

const crawlWebsite = vi.fn();

vi.mock("@lead-radar/providers", async () => {
  const actual = await vi.importActual<typeof import("@lead-radar/providers")>("@lead-radar/providers");
  return { ...actual, crawlWebsite: (...args: unknown[]) => crawlWebsite(...args) };
});

function makeJob(
  data: LeadEnrichmentJobData,
): Job<LeadEnrichmentJobData> & { updateProgress: ReturnType<typeof vi.fn> } {
  return { data, updateProgress: vi.fn() } as unknown as Job<LeadEnrichmentJobData> & {
    updateProgress: ReturnType<typeof vi.fn>;
  };
}

function makePrisma(lead: {
  id: string;
  organizationId: string;
  businessName: string;
  websiteUrl: string | null;
  phone: string | null;
  email: string | null;
  googlePlaceId?: string | null;
}) {
  return {
    lead: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ googlePlaceId: null, ...lead }),
      update: vi.fn(),
    },
    leadWebsite: { upsert: vi.fn() },
    leadContact: { deleteMany: vi.fn(), createMany: vi.fn() },
    leadSocialProfile: { upsert: vi.fn() },
    websiteAudit: { create: vi.fn() },
    googleBusinessProfile: { upsert: vi.fn() },
    growthOpportunity: { deleteMany: vi.fn(), createMany: vi.fn() },
    opportunityScore: { upsert: vi.fn() },
    leadActivity: { create: vi.fn() },
    searchResult: { findFirst: vi.fn().mockResolvedValue(null) },
    notification: { create: vi.fn() },
  };
}

const jobData: LeadEnrichmentJobData = {
  leadId: "lead-1",
  organizationId: "org-1",
  triggeredByUserId: "user-1",
};

function makeExtraction(overrides: Partial<WebsiteExtraction> = {}): WebsiteExtraction {
  return {
    startUrl: "https://examplebiz.test/",
    https: true,
    emails: ["hello@examplebiz.test"],
    phones: ["+8801711111111"],
    socialLinks: [{ platform: "FACEBOOK", url: "https://facebook.com/examplebiz" }],
    contactUrl: "https://examplebiz.test/contact",
    bookingUrl: null,
    hasContactCta: true,
    title: "Example Biz",
    metaDescription: "We do things",
    h1: "Example Biz",
    headings: ["Example Biz"],
    canonical: "https://examplebiz.test/",
    robotsMeta: null,
    sitemapUrl: null,
    openGraph: {},
    structuredData: [],
    viewport: "width=device-width",
    serviceInfo: [],
    accessibility: {
      totalImages: 2,
      imagesWithoutAlt: 0,
      hasLangAttribute: true,
      headingHierarchyOk: true,
      hasViewportMeta: true,
    },
    technologies: [],
    pagesCrawled: ["https://examplebiz.test/"],
    robotsTxtRespected: true,
    performance: { homepageResponseTimeMs: 120, homepageSizeBytes: 4096 },
    brokenLinksChecked: 0,
    brokenLinksFound: 0,
    ...overrides,
  };
}

describe("lead enrichment / digital intelligence processor", () => {
  beforeEach(() => {
    crawlWebsite.mockReset();
  });

  it("crawls the lead's website, saves contacts/social/website/audit, and marks COMPLETED", async () => {
    const extraction = makeExtraction();
    crawlWebsite.mockResolvedValue(extraction);

    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "Example Biz",
      websiteUrl: "https://examplebiz.test/",
      phone: null,
      email: null,
    });
    const job = makeJob(jobData);

    const result = await createLeadEnrichmentProcessor(prisma)(job);

    expect(result).toMatchObject({
      crawled: true,
      pagesCrawled: 1,
      emailsFound: 1,
      phonesFound: 1,
      socialProfilesFound: 1,
      googleProfileStatus: "UNVERIFIED",
    });
    expect(result.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunityScore).toBeLessThanOrEqual(100);

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { enrichmentStatus: "RUNNING", enrichmentProgress: 10, enrichmentError: null },
    });

    expect(prisma.leadWebsite.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.websiteAudit.create).toHaveBeenCalledTimes(1);
    const auditData = prisma.websiteAudit.create.mock.calls[0]![0].data;
    expect(auditData.websiteScore).not.toBeNull();
    expect(auditData.mobileScore).toBe(100);

    expect(prisma.leadContact.deleteMany).toHaveBeenCalledWith({
      where: { leadId: "lead-1", source: "WEBSITE" },
    });
    expect(prisma.leadContact.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.leadSocialProfile.upsert).toHaveBeenCalledTimes(1);

    expect(prisma.googleBusinessProfile.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.opportunityScore.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.growthOpportunity.deleteMany).toHaveBeenCalledWith({ where: { leadId: "lead-1" } });
    expect(prisma.leadActivity.create).toHaveBeenCalledTimes(1);

    const finalUpdate = prisma.lead.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({ enrichmentStatus: "COMPLETED", enrichmentProgress: 100 });
    expect(typeof finalUpdate.data.opportunityScore).toBe("number");

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const notification = prisma.notification.create.mock.calls[0]![0].data;
    expect(notification.userId).toBe("user-1");
    expect(notification.type).toBe("lead.enrichment.completed");
  });

  it("fills in Lead.phone/email only when they were previously empty — never overwrites known data", async () => {
    crawlWebsite.mockResolvedValue(makeExtraction());

    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "Example Biz",
      websiteUrl: "https://examplebiz.test/",
      phone: "+8809999999999", // already known — must not be overwritten
      email: null, // unknown — should be filled from the crawl
    });

    await createLeadEnrichmentProcessor(prisma)(makeJob(jobData));

    const finalUpdate = prisma.lead.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.phone).toBeUndefined();
    expect(finalUpdate.data.email).toBe("hello@examplebiz.test");
  });

  it("completes successfully (not a failure) when the lead has no website on file, scoring it a high opportunity", async () => {
    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "No Website Biz",
      websiteUrl: null,
      phone: "+8801700000000",
      email: null,
    });

    const result = await createLeadEnrichmentProcessor(prisma)(makeJob(jobData));

    expect(crawlWebsite).not.toHaveBeenCalled();
    expect(result.crawled).toBe(false);
    expect(prisma.leadWebsite.upsert).not.toHaveBeenCalled();
    expect(prisma.websiteAudit.create).not.toHaveBeenCalled();

    const finalUpdate = prisma.lead.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({ enrichmentStatus: "COMPLETED" });

    const growthData = prisma.growthOpportunity.createMany.mock.calls[0]![0].data;
    expect(growthData.some((f: { title: string }) => f.title === "No website detected")).toBe(true);
  });

  it("marks the lead FAILED and notifies the triggering user when the crawl throws", async () => {
    crawlWebsite.mockRejectedValue(new Error("DNS resolution failed"));

    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "Broken Site Biz",
      websiteUrl: "https://this-does-not-resolve.test/",
      phone: null,
      email: null,
    });

    await expect(createLeadEnrichmentProcessor(prisma)(makeJob(jobData))).rejects.toThrow(
      "DNS resolution failed",
    );

    const finalUpdate = prisma.lead.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data).toMatchObject({ enrichmentStatus: "FAILED", enrichmentError: "DNS resolution failed" });

    const notification = prisma.notification.create.mock.calls[0]![0].data;
    expect(notification.type).toBe("lead.enrichment.failed");

    // The pipeline never got far enough to score anything — no partial/fabricated results.
    expect(prisma.opportunityScore.upsert).not.toHaveBeenCalled();
  });

  it("reports real, non-fabricated zero counts when the crawl finds nothing", async () => {
    crawlWebsite.mockResolvedValue(
      makeExtraction({ emails: [], phones: [], socialLinks: [], pagesCrawled: ["https://examplebiz.test/"] }),
    );

    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "Quiet Biz",
      websiteUrl: "https://examplebiz.test/",
      phone: null,
      email: null,
    });

    const result = await createLeadEnrichmentProcessor(prisma)(makeJob(jobData));

    expect(result).toMatchObject({ emailsFound: 0, phonesFound: 0, socialProfilesFound: 0 });
    expect(prisma.leadContact.createMany).not.toHaveBeenCalled();
    expect(prisma.leadSocialProfile.upsert).not.toHaveBeenCalled();
  });

  it("marks the Google profile UNVERIFIED (never a confident NOT_FOUND) when there's no place id and no discovery record", async () => {
    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "Manual Biz",
      websiteUrl: null,
      phone: "+8801700000000",
      email: null,
    });

    const result = await createLeadEnrichmentProcessor(prisma)(makeJob(jobData));

    expect(result.googleProfileStatus).toBe("UNVERIFIED");
    const profileData = prisma.googleBusinessProfile.upsert.mock.calls[0]![0];
    expect(profileData.create.status).toBe("UNVERIFIED");
    expect(profileData.create.score).toBeNull();
  });

  it("replays the original mock-mode discovery result for a mock-sourced lead's Google audit", async () => {
    const prisma = makePrisma({
      id: "lead-1",
      organizationId: "org-1",
      businessName: "Mock Sourced Biz",
      websiteUrl: null,
      phone: "+8801700000000",
      email: null,
    });
    // A real mock-provider id, decodable by MockLeadDiscoveryProvider (see mock-id.ts).
    const results = await new MockLeadDiscoveryProvider({ simulateLatency: false }).searchBusinesses({
      query: "coffee shop",
      location: "Banani, Dhaka",
      maxResults: 1,
    });
    prisma.searchResult.findFirst.mockResolvedValue({
      externalId: results[0]!.externalId,
      search: { providerMode: "MOCK" },
    });

    const result = await createLeadEnrichmentProcessor(prisma)(makeJob(jobData));

    expect(["FOUND", "NOT_FOUND_IN_CURRENT_SEARCH"]).toContain(result.googleProfileStatus);
    const profileData = prisma.googleBusinessProfile.upsert.mock.calls[0]![0];
    expect(profileData.create.placeId).toBeNull(); // never a fabricated real place id for a mock lead
  });
});
