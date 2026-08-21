export const FOLLOW_UP_REMINDER_QUEUE = "follow-up-reminder";

export interface FollowUpReminderJobData {
  followUpId: string;
  organizationId: string;
  userId: string;
  leadId: string;
}
