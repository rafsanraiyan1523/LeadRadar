import { IsIn, IsObject, IsOptional } from 'class-validator';

/**
 * The only activity types a client is allowed to log directly (no natural
 * backend trigger for these — they happen entirely in the browser: copying
 * a generated message, or opening a channel link). Every other activity
 * type (status changes, notes, follow-ups, saves, audits, generations) is
 * always written server-side, next to the action it describes, so it can
 * never be spoofed via this endpoint.
 */
export const CLIENT_LOGGABLE_ACTIVITY_TYPES = [
  'lead.message_copied',
  'lead.email_opened',
  'lead.whatsapp_opened',
  'lead.facebook_opened',
] as const;

export class LogLeadActivityDto {
  @IsIn(CLIENT_LOGGABLE_ACTIVITY_TYPES)
  type!: (typeof CLIENT_LOGGABLE_ACTIVITY_TYPES)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
