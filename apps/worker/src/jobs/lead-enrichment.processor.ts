import type { Job } from "bullmq";
import {
  GooglePlacesProvider,
  MockLeadDiscoveryProvider,
  buildAuditIssues,
  buildGoogleBusinessAuditResult,
  calculateContactabilityScore,
  computeAccessibilityScore,
  computeOpportunityScore,
  computeSeoScore,
  computeWebsiteAudit,
  crawlWebsite,
  generateGrowthOpportunities,
} from "@lead-radar/providers";
import type {
  BusinessDetails,
  ContactabilitySignals,
  GoogleBusinessAuditResult,
  GoogleBusinessSignals,
  LeadEnrichmentJobData,
  WebsiteExtraction,
} from "@lead-radar/types";
import type { Prisma } from "@lead-radar/db";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/** Narrow slice of PrismaClient this processor needs — keeps it unit-testable without a real DB. */
export interface LeadEnrichmentProcessorPrisma {
  lead: {
    findUniqueOrThrow: (args: { where: { id: string } }) => Promise<{
      id: string;
      organizationId: string;
      businessName: string;
      websiteUrl: string | null;
      phone: string | null;
      email: string | null;
      googlePlaceId: string | null;
    }>;
    update: (args: { where: { id: string }; data: Prisma.LeadUpdateInput }) => Promise<unknown>;
  };
  leadWebsite: {
    upsert: (args: {
      where: { leadId: string };
      create: Prisma.LeadWebsiteUncheckedCreateInput;
      update: Prisma.LeadWebsiteUpdateInput;
    }) => Promise<unknown>;
  };
  leadContact: {
    deleteMany: (args: { where: { leadId: string; source: "WEBSITE" } }) => Promise<unknown>;
    createMany: (args: { data: Prisma.LeadContactCreateManyInput[] }) => Promise<unknown>;
  };
  leadSocialProfile: {
    upsert: (args: {
      where: { leadId_platform: { leadId: string; platform: Prisma.LeadSocialProfileUncheckedCreateInput["platform"] } };
      create: Prisma.LeadSocialProfileUncheckedCreateInput;
      update: Prisma.LeadSocialProfileUpdateInput;
    }) => Promise<unknown>;
  };
  websiteAudit: {
    create: (args: { data: Prisma.WebsiteAuditUncheckedCreateInput }) => Promise<unknown>;
  };
  googleBusinessProfile: {
    upsert: (args: {
      where: { leadId: string };
      create: Prisma.GoogleBusinessProfileUncheckedCreateInput;
      update: Prisma.GoogleBusinessProfileUpdateInput;
    }) => Promise<unknown>;
  };
  growthOpportunity: {
    deleteMany: (args: { where: { leadId: string } }) => Promise<unknown>;
    createMany: (args: { data: Prisma.GrowthOpportunityCreateManyInput[] }) => Promise<unknown>;
  };
  opportunityScore: {
    upsert: (args: {
      where: { leadId: string };
      create: Prisma.OpportunityScoreUncheckedCreateInput;
      update: Prisma.OpportunityScoreUpdateInput;
    }) => Promise<unknown>;
  };
  leadActivity: {
    create: (args: { data: Prisma.LeadActivityUncheckedCreateInput }) => Promise<unknown>;
  };
  searchResult: {
    findFirst: (args: {
      where: { promotedToLeadId: string };
      select: { externalId: true; search: { select: { providerMode: true } } };
    }) => Promise<{ externalId: string | null; search: { providerMode: string } } | null>;
  };
  notification: {
    create: (args: { data: Prisma.NotificationUncheckedCreateInput }) => Promise<unknown>;
  };
}

export interface LeadEnrichmentResult {
  crawled: boolean;
  pagesCrawled: number;
  emailsFound: number;
  phonesFound: number;
  socialProfilesFound: number;
  opportunityScore: number;
  googleProfileStatus: GoogleBusinessAuditResult["status"];
  growthOpportunitiesFound: number;
}

export function createLeadEnrichmentProcessor(prisma: LeadEnrichmentProcessorPrisma) {
  return async function processLeadEnrichmentJob(
    job: Job<LeadEnrichmentJobData>,
  ): Promise<LeadEnrichmentResult> {
    const { leadId, organizationId, triggeredByUserId } = job.data;

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

    await prisma.lead.update({
      where: { id: leadId },
      data: { enrichmentStatus: "RUNNING", enrichmentProgress: 10, enrichmentError: null },
    });
    await job.updateProgress(10);

    try {
      let extraction: WebsiteExtraction | null = null;

      if (lead.websiteUrl) {
        extraction = await crawlWebsite(lead.websiteUrl, {
          maxPages: env.crawlerMaxPages,
          maxResponseBytes: env.crawlerMaxResponseBytes,
          timeoutMs: env.crawlerRequestTimeoutMs,
          requestDelayMs: env.crawlerRequestDelayMs,
        });
      }

      await prisma.lead.update({ where: { id: leadId }, data: { enrichmentProgress: 40 } });
      await job.updateProgress(40);

      const finalPhone = extraction?.phones[0] && !lead.phone ? extraction.phones[0] : lead.phone;
      const finalEmail = extraction?.emails[0] && !lead.email ? extraction.emails[0] : lead.email;

      const websiteAuditResult = computeWebsiteAudit(extraction);

      if (extraction) {
        await saveExtraction(prisma, leadId, extraction, websiteAuditResult);
      }

      await prisma.lead.update({ where: { id: leadId }, data: { enrichmentProgress: 65 } });
      await job.updateProgress(65);

      const googleAudit = await auditGoogleBusiness(prisma, lead);
      await saveGoogleBusinessProfile(prisma, leadId, lead.googlePlaceId, googleAudit);

      await prisma.lead.update({ where: { id: leadId }, data: { enrichmentProgress: 85 } });
      await job.updateProgress(85);

      const contactabilitySignals: ContactabilitySignals = {
        hasPhone: !!finalPhone,
        hasEmail: !!finalEmail,
        hasWebsite: !!lead.websiteUrl,
        hasFacebook: extraction?.socialLinks.some((s) => s.platform === "FACEBOOK") ?? false,
        hasInstagram: extraction?.socialLinks.some((s) => s.platform === "INSTAGRAM") ?? false,
        hasLinkedIn: extraction?.socialLinks.some((s) => s.platform === "LINKEDIN") ?? false,
        hasBookingUrl: !!extraction?.bookingUrl,
        hasContactPage: !!extraction?.contactUrl,
        hasContactCta: !!extraction?.hasContactCta,
      };
      const contactability = calculateContactabilityScore(contactabilitySignals);

      const opportunity = computeOpportunityScore({
        websiteScore: websiteAuditResult.websiteScore,
        seoScore: websiteAuditResult.seo?.score ?? null,
        mobileScore: websiteAuditResult.mobile?.score ?? null,
        conversionScore: websiteAuditResult.conversion?.score ?? null,
        technicalScore: websiteAuditResult.technical?.score ?? null,
        contactabilityScore: contactability.score,
        googleProfile: googleAudit,
      });

      const findings = generateGrowthOpportunities({
        websiteUrl: lead.websiteUrl,
        extraction,
        conversionScore: websiteAuditResult.conversion?.score ?? null,
        googleProfile: googleAudit,
      });

      await prisma.growthOpportunity.deleteMany({ where: { leadId } });
      if (findings.length > 0) {
        await prisma.growthOpportunity.createMany({
          data: findings.map((f) => ({
            leadId,
            type: f.category,
            title: f.title,
            evidence: f.evidence,
            recommendation: f.recommendation,
            impact: f.severity,
          })),
        });
      }

      await prisma.opportunityScore.upsert({
        where: { leadId },
        create: { leadId, score: opportunity.score, breakdown: opportunity.breakdown as unknown as Prisma.InputJsonValue },
        update: {
          score: opportunity.score,
          breakdown: opportunity.breakdown as unknown as Prisma.InputJsonValue,
          calculatedAt: new Date(),
        },
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...(finalPhone !== lead.phone ? { phone: finalPhone } : {}),
          ...(finalEmail !== lead.email ? { email: finalEmail } : {}),
          opportunityScore: opportunity.score,
          enrichmentStatus: "COMPLETED",
          enrichmentProgress: 100,
          lastEnrichedAt: new Date(),
        },
      });
      await job.updateProgress(100);

      await prisma.leadActivity.create({
        data: {
          leadId,
          organizationId,
          userId: triggeredByUserId,
          type: "lead.audit_completed",
          metadata: {
            opportunityScore: opportunity.score,
            opportunityLevel: opportunity.level,
            googleProfileStatus: googleAudit.status,
            growthOpportunitiesFound: findings.length,
          },
        },
      });

      await prisma.notification.create({
        data: {
          organizationId,
          userId: triggeredByUserId,
          type: "lead.enrichment.completed",
          title: `Digital intelligence audit complete for ${lead.businessName}`,
          body: extraction
            ? `Opportunity score ${opportunity.score}/100 (${opportunity.level}). Found ${extraction.emails.length} email(s), ${extraction.phones.length} phone(s), ${extraction.socialLinks.length} social profile(s), and ${findings.length} growth opportunit${findings.length === 1 ? "y" : "ies"}.`
            : `No website was on file — opportunity score ${opportunity.score}/100 (${opportunity.level}) based on existing contact and Google Business signals.`,
          metadata: { leadId },
        },
      });

      logger.info(
        { leadId, crawled: !!extraction, opportunityScore: opportunity.score, googleProfileStatus: googleAudit.status },
        "Lead digital intelligence audit completed",
      );

      return {
        crawled: !!extraction,
        pagesCrawled: extraction?.pagesCrawled.length ?? 0,
        emailsFound: extraction?.emails.length ?? 0,
        phonesFound: extraction?.phones.length ?? 0,
        socialProfilesFound: extraction?.socialLinks.length ?? 0,
        opportunityScore: opportunity.score,
        googleProfileStatus: googleAudit.status,
        growthOpportunitiesFound: findings.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown enrichment error";
      await prisma.lead.update({
        where: { id: leadId },
        data: { enrichmentStatus: "FAILED", enrichmentError: message },
      });
      await prisma.notification.create({
        data: {
          organizationId,
          userId: triggeredByUserId,
          type: "lead.enrichment.failed",
          title: `Digital intelligence audit failed for ${lead.businessName}`,
          body: message,
          metadata: { leadId },
        },
      });
      logger.error({ leadId, err: error }, "Lead digital intelligence audit failed");
      throw error;
    }
  };
}

async function saveExtraction(
  prisma: LeadEnrichmentProcessorPrisma,
  leadId: string,
  extraction: WebsiteExtraction,
  websiteAuditResult: ReturnType<typeof computeWebsiteAudit>,
): Promise<void> {
  const now = new Date();

  await prisma.leadWebsite.upsert({
    where: { leadId },
    create: {
      leadId,
      url: extraction.startUrl,
      isReachable: extraction.pagesCrawled.length > 0,
      hasSsl: extraction.https,
      technologies: extraction.technologies,
      metadata: extraction as unknown as Prisma.InputJsonValue,
      pagesCrawled: extraction.pagesCrawled.length,
      lastCheckedAt: now,
    },
    update: {
      isReachable: extraction.pagesCrawled.length > 0,
      hasSsl: extraction.https,
      technologies: extraction.technologies,
      metadata: extraction as unknown as Prisma.InputJsonValue,
      pagesCrawled: extraction.pagesCrawled.length,
      lastCheckedAt: now,
    },
  });

  await prisma.websiteAudit.create({
    data: {
      leadId,
      websiteScore: websiteAuditResult.websiteScore,
      seoScore: computeSeoScore(extraction),
      mobileScore: websiteAuditResult.mobile?.score ?? null,
      conversionScore: websiteAuditResult.conversion?.score ?? null,
      technicalScore: websiteAuditResult.technical?.score ?? null,
      accessibilityScore: computeAccessibilityScore(extraction.accessibility),
      hasSsl: extraction.https,
      isMobileFriendly: extraction.accessibility.hasViewportMeta,
      techStack: extraction.technologies,
      issues: buildAuditIssues(extraction),
      signals: {
        seo: websiteAuditResult.seo,
        mobile: websiteAuditResult.mobile,
        conversion: websiteAuditResult.conversion,
        technical: websiteAuditResult.technical,
        performance: extraction.performance,
        brokenLinksChecked: extraction.brokenLinksChecked,
        brokenLinksFound: extraction.brokenLinksFound,
      } as unknown as Prisma.InputJsonValue,
      auditedAt: now,
    },
  });

  await prisma.leadContact.deleteMany({ where: { leadId, source: "WEBSITE" } });
  const contactRows: Prisma.LeadContactCreateManyInput[] = [
    ...extraction.emails.map((value) => ({
      leadId,
      type: "EMAIL" as const,
      value,
      source: "WEBSITE" as const,
      verified: true,
      lastCheckedAt: now,
    })),
    ...extraction.phones.map((value) => ({
      leadId,
      type: "PHONE" as const,
      value,
      source: "WEBSITE" as const,
      verified: true,
      lastCheckedAt: now,
    })),
    ...(extraction.bookingUrl
      ? [
          {
            leadId,
            type: "BOOKING_URL" as const,
            value: extraction.bookingUrl,
            source: "WEBSITE" as const,
            verified: true,
            lastCheckedAt: now,
          },
        ]
      : []),
  ];
  if (contactRows.length > 0) {
    await prisma.leadContact.createMany({ data: contactRows });
  }

  for (const social of extraction.socialLinks) {
    await prisma.leadSocialProfile.upsert({
      where: { leadId_platform: { leadId, platform: social.platform } },
      create: { leadId, platform: social.platform, url: social.url },
      update: { url: social.url },
    });
  }
}

/**
 * GoogleBusinessAuditService's live-lookup step. Only ever calls the real
 * Places API when the lead has a genuine Google Place ID (set only for
 * leads originally discovered in GOOGLE mode — see lead-discovery.service).
 * For mock-mode leads it replays the same deterministic mock lookup so the
 * app stays fully functional at zero cost; leads with no discovery record
 * at all are honestly UNVERIFIED rather than guessed at.
 */
async function auditGoogleBusiness(
  prisma: LeadEnrichmentProcessorPrisma,
  lead: { id: string; googlePlaceId: string | null },
): Promise<GoogleBusinessAuditResult> {
  if (lead.googlePlaceId) {
    if (!env.googlePlacesApiKey) {
      return buildGoogleBusinessAuditResult({
        status: "UNVERIFIED",
        signals: null,
        reason: "Google Places API key is not configured — cannot verify the live profile.",
      });
    }
    const provider = new GooglePlacesProvider({
      apiKey: env.googlePlacesApiKey,
      maxConcurrentRequests: env.maxConcurrentRequests,
      rateLimit: { maxRequests: env.googleRequestRateLimit, windowMs: 1000 },
    });
    try {
      const details = await provider.getBusinessDetails(lead.googlePlaceId);
      if (!details) {
        return buildGoogleBusinessAuditResult({
          status: "NOT_FOUND_IN_CURRENT_SEARCH",
          signals: null,
          reason: "Google Places returned no result for this business's stored place ID.",
        });
      }
      return buildGoogleBusinessAuditResult({ status: "FOUND", signals: toGoogleBusinessSignals(details), reason: null });
    } catch (error) {
      return buildGoogleBusinessAuditResult({
        status: "UNVERIFIED",
        signals: null,
        reason: `Google Business lookup failed: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }
  }

  const searchResult = await prisma.searchResult.findFirst({
    where: { promotedToLeadId: lead.id },
    select: { externalId: true, search: { select: { providerMode: true } } },
  });

  if (searchResult?.externalId && searchResult.search.providerMode === "MOCK") {
    try {
      const details = await new MockLeadDiscoveryProvider().getBusinessDetails(searchResult.externalId);
      if (!details || !details.hasGoogleProfile) {
        return buildGoogleBusinessAuditResult({
          status: "NOT_FOUND_IN_CURRENT_SEARCH",
          signals: null,
          reason: "The original search recorded no Google Business profile for this business.",
        });
      }
      return buildGoogleBusinessAuditResult({ status: "FOUND", signals: toGoogleBusinessSignals(details), reason: null });
    } catch {
      return buildGoogleBusinessAuditResult({
        status: "UNVERIFIED",
        signals: null,
        reason: "Mock provider lookup failed unexpectedly.",
      });
    }
  }

  return buildGoogleBusinessAuditResult({
    status: "UNVERIFIED",
    signals: null,
    reason: "No Google identifier on file for this lead.",
  });
}

function toGoogleBusinessSignals(details: BusinessDetails): GoogleBusinessSignals {
  return {
    displayName: details.name,
    primaryCategory: details.category,
    categories: details.additionalCategories,
    rating: details.rating,
    userRatingCount: details.reviewCount,
    businessStatus: details.businessStatus,
    phone: details.phone,
    websiteUrl: details.websiteUrl,
    address: details.address,
    openingHours: details.openingHours,
    mapsUri: details.googleMapsUri,
    photosAvailable: details.photosAvailable,
  };
}

async function saveGoogleBusinessProfile(
  prisma: LeadEnrichmentProcessorPrisma,
  leadId: string,
  googlePlaceId: string | null,
  audit: GoogleBusinessAuditResult,
): Promise<void> {
  const now = new Date();
  const s = audit.signals;

  const fields: Omit<Prisma.GoogleBusinessProfileUncheckedCreateInput, "leadId"> = {
    status: audit.status as Prisma.GoogleBusinessProfileUncheckedCreateInput["status"],
    score: audit.score,
    reason: audit.reason,
    // Never populated from a mock provider id — only ever a real Google Place ID, or null.
    placeId: googlePlaceId,
    displayName: s?.displayName ?? null,
    primaryCategory: s?.primaryCategory ?? null,
    categories: s?.categories ?? [],
    rating: s?.rating ?? null,
    userRatingCount: s?.userRatingCount ?? null,
    businessStatus: s?.businessStatus ?? null,
    phone: s?.phone ?? null,
    websiteUrl: s?.websiteUrl ?? null,
    address: s?.address ?? null,
    openingHours: s?.openingHours ?? undefined,
    photosAvailable: s?.photosAvailable ?? null,
    mapsUri: s?.mapsUri ?? null,
    fetchedAt: now,
  };

  await prisma.googleBusinessProfile.upsert({
    where: { leadId },
    create: { leadId, ...fields },
    update: fields,
  });
}
