import type { Job } from "bullmq";
import type { FollowUpReminderJobData } from "@lead-radar/types";
import type { Prisma } from "@lead-radar/db";
import { logger } from "../lib/logger";

/** Narrow slice of PrismaClient this processor needs — keeps it unit-testable without a real DB. */
export interface FollowUpReminderProcessorPrisma {
  followUp: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      status: string;
      note: string | null;
    } | null>;
  };
  lead: {
    findUnique: (args: { where: { id: string } }) => Promise<{ businessName: string } | null>;
  };
  notification: {
    create: (args: { data: Prisma.NotificationUncheckedCreateInput }) => Promise<unknown>;
  };
}

export interface FollowUpReminderResult {
  notified: boolean;
}

/**
 * Fires at the follow-up's dueAt (a delayed BullMQ job scheduled when the
 * follow-up was created — see CrmService.createFollowUp). Re-checks the
 * follow-up's current status first: if it was already completed or
 * cancelled since scheduling (CrmService removes the delayed job in that
 * case, but this guards the race where the job already fired), no
 * notification is created.
 */
export function createFollowUpReminderProcessor(
  prisma: FollowUpReminderProcessorPrisma,
) {
  return async function processFollowUpReminderJob(
    job: Job<FollowUpReminderJobData>,
  ): Promise<FollowUpReminderResult> {
    const { followUpId, organizationId, userId, leadId } = job.data;

    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
    });
    if (!followUp || followUp.status !== "PENDING") {
      return { notified: false };
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const businessName = lead?.businessName ?? "this lead";

    await prisma.notification.create({
      data: {
        organizationId,
        userId,
        type: "follow_up.due",
        title: `Follow-up due: ${businessName}`,
        body: followUp.note,
        metadata: { leadId, followUpId },
      },
    });

    logger.info({ followUpId, leadId }, "Follow-up reminder notification created");
    return { notified: true };
  };
}
