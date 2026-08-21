import { describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { FollowUpReminderJobData } from "@lead-radar/types";
import { createFollowUpReminderProcessor } from "./follow-up-reminder.processor";

function makeJob(data: FollowUpReminderJobData): Job<FollowUpReminderJobData> {
  return { data } as unknown as Job<FollowUpReminderJobData>;
}

const jobData: FollowUpReminderJobData = {
  followUpId: "fu-1",
  organizationId: "org-1",
  userId: "user-1",
  leadId: "lead-1",
};

describe("createFollowUpReminderProcessor", () => {
  it("creates a due notification for a still-pending follow-up", async () => {
    const prisma = {
      followUp: {
        findUnique: vi.fn().mockResolvedValue({
          id: "fu-1",
          status: "PENDING",
          note: "Ask about pricing",
        }),
      },
      lead: {
        findUnique: vi.fn().mockResolvedValue({ businessName: "Example Biz" }),
      },
      notification: { create: vi.fn() },
    };

    const result = await createFollowUpReminderProcessor(prisma)(makeJob(jobData));

    expect(result).toEqual({ notified: true });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        type: "follow_up.due",
        title: "Follow-up due: Example Biz",
        body: "Ask about pricing",
        metadata: { leadId: "lead-1", followUpId: "fu-1" },
      }),
    });
  });

  it("skips notifying when the follow-up was already completed", async () => {
    const prisma = {
      followUp: {
        findUnique: vi.fn().mockResolvedValue({ id: "fu-1", status: "DONE", note: null }),
      },
      lead: { findUnique: vi.fn() },
      notification: { create: vi.fn() },
    };

    const result = await createFollowUpReminderProcessor(prisma)(makeJob(jobData));

    expect(result).toEqual({ notified: false });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("skips notifying when the follow-up was cancelled", async () => {
    const prisma = {
      followUp: {
        findUnique: vi.fn().mockResolvedValue({ id: "fu-1", status: "CANCELLED", note: null }),
      },
      lead: { findUnique: vi.fn() },
      notification: { create: vi.fn() },
    };

    const result = await createFollowUpReminderProcessor(prisma)(makeJob(jobData));

    expect(result).toEqual({ notified: false });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("skips notifying when the follow-up no longer exists", async () => {
    const prisma = {
      followUp: { findUnique: vi.fn().mockResolvedValue(null) },
      lead: { findUnique: vi.fn() },
      notification: { create: vi.fn() },
    };

    const result = await createFollowUpReminderProcessor(prisma)(makeJob(jobData));

    expect(result).toEqual({ notified: false });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it("falls back to a generic name when the lead can't be found", async () => {
    const prisma = {
      followUp: {
        findUnique: vi.fn().mockResolvedValue({ id: "fu-1", status: "PENDING", note: null }),
      },
      lead: { findUnique: vi.fn().mockResolvedValue(null) },
      notification: { create: vi.fn() },
    };

    await createFollowUpReminderProcessor(prisma)(makeJob(jobData));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "Follow-up due: this lead" }),
    });
  });
});
