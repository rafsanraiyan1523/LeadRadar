import {
  FOLLOW_UP_REMINDER_QUEUE,
  LEAD_DISCOVERY_QUEUE,
  LEAD_ENRICHMENT_QUEUE,
} from "@lead-radar/types";
import { logger } from "./lib/logger";
import { connection } from "./lib/redis";
import { prisma } from "./lib/prisma";
import { startHealthServer } from "./health/health-server";
import { createWorker } from "./queues/registry";
import { createLeadDiscoveryProcessor } from "./jobs/lead-discovery.processor";
import { createLeadEnrichmentProcessor } from "./jobs/lead-enrichment.processor";
import { createFollowUpReminderProcessor } from "./jobs/follow-up-reminder.processor";

async function bootstrap(): Promise<void> {
  connection.on("connect", () => logger.info("Connected to Redis"));
  connection.on("error", (error) => logger.error({ err: error }, "Redis connection error"));

  const leadDiscoveryWorker = createWorker(
    LEAD_DISCOVERY_QUEUE,
    createLeadDiscoveryProcessor(prisma),
  );
  leadDiscoveryWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Lead discovery job failed");
  });

  const leadEnrichmentWorker = createWorker(
    LEAD_ENRICHMENT_QUEUE,
    createLeadEnrichmentProcessor(prisma),
  );
  leadEnrichmentWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Lead enrichment job failed");
  });

  const followUpReminderWorker = createWorker(
    FOLLOW_UP_REMINDER_QUEUE,
    createFollowUpReminderProcessor(prisma),
  );
  followUpReminderWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Follow-up reminder job failed");
  });

  startHealthServer();
  logger.info("LeadRadar worker started");

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down worker");
    await leadDiscoveryWorker.close();
    await leadEnrichmentWorker.close();
    await followUpReminderWorker.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "Worker failed to start");
  process.exit(1);
});
