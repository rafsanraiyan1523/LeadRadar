import type { Job } from "bullmq";
import { createLeadDiscoveryProvider } from "@lead-radar/providers";
import type { LeadDiscoveryJobData } from "@lead-radar/types";
import type { Prisma } from "@lead-radar/db";
import { normalizeBusinessSummary } from "./normalize-business";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/** Narrow slice of PrismaClient this processor needs — keeps it unit-testable without a real DB. */
export interface LeadDiscoveryProcessorPrisma {
  search: {
    update: (args: { where: { id: string }; data: Prisma.SearchUpdateInput }) => Promise<unknown>;
  };
  searchResult: {
    createMany: (args: { data: Prisma.SearchResultCreateManyInput[] }) => Promise<unknown>;
  };
}

export function createLeadDiscoveryProcessor(prisma: LeadDiscoveryProcessorPrisma) {
  return async function processLeadDiscoveryJob(
    job: Job<LeadDiscoveryJobData>,
  ): Promise<{ resultCount: number }> {
    const { searchId, query, location, radiusMeters, maxResults, providerMode } = job.data;

    await prisma.search.update({
      where: { id: searchId },
      data: { status: "RUNNING", progress: 10 },
    });
    await job.updateProgress(10);

    try {
      const provider = createLeadDiscoveryProvider({
        mode: providerMode,
        google: env.googlePlacesApiKey
          ? {
              apiKey: env.googlePlacesApiKey,
              maxConcurrentRequests: env.maxConcurrentRequests,
              rateLimit: { maxRequests: env.googleRequestRateLimit, windowMs: 1000 },
            }
          : undefined,
      });

      const results = await provider.searchBusinesses({
        query,
        location,
        radiusMeters,
        maxResults,
      });

      await prisma.search.update({ where: { id: searchId }, data: { progress: 60 } });
      await job.updateProgress(60);

      if (results.length > 0) {
        await prisma.searchResult.createMany({
          data: results.map((business) => normalizeBusinessSummary(searchId, business)),
        });
      }

      await prisma.search.update({
        where: { id: searchId },
        data: {
          status: "COMPLETED",
          progress: 100,
          resultCount: results.length,
          completedAt: new Date(),
        },
      });
      await job.updateProgress(100);

      logger.info({ searchId, resultCount: results.length }, "Lead discovery search completed");
      return { resultCount: results.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      await prisma.search.update({
        where: { id: searchId },
        data: { status: "FAILED", errorMessage: message },
      });
      logger.error({ searchId, err: error }, "Lead discovery search failed");
      throw error;
    }
  };
}
