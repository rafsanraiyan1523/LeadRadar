import { STATUS_LABELS } from "./pipeline-config";
import type { LeadStatus } from "./crm-types";

const TYPE_LABELS: Record<string, string> = {
  "lead.saved_from_search": "Saved from search results",
  "lead.audit_completed": "Digital intelligence audit completed",
  "lead.status_changed": "Status changed",
  "lead.note_added": "Note added",
  "lead.follow_up_created": "Follow-up created",
  "lead.message_generated": "Outreach message generated",
  "lead.message_copied": "Message copied",
  "lead.email_opened": "Email opened",
  "lead.whatsapp_opened": "WhatsApp opened",
  "lead.facebook_opened": "Facebook opened",
};

export function describeActivity(activity: { type: string; metadata: unknown }): string {
  const label = TYPE_LABELS[activity.type] ?? activity.type;
  const meta =
    activity.metadata && typeof activity.metadata === "object"
      ? (activity.metadata as Record<string, unknown>)
      : null;

  if (activity.type === "lead.audit_completed" && typeof meta?.opportunityScore === "number") {
    return `${label} — opportunity score ${meta.opportunityScore}/100`;
  }
  if (activity.type === "lead.status_changed" && meta?.from && meta?.to) {
    const from = STATUS_LABELS[meta.from as LeadStatus] ?? String(meta.from);
    const to = STATUS_LABELS[meta.to as LeadStatus] ?? String(meta.to);
    return `${label}: ${from} → ${to}`;
  }
  if (activity.type === "lead.note_added" && typeof meta?.text === "string") {
    return `${label}: "${meta.text.length > 60 ? `${meta.text.slice(0, 60)}…` : meta.text}"`;
  }
  if (activity.type === "lead.follow_up_created" && typeof meta?.dueAt === "string") {
    return `${label} — due ${new Date(meta.dueAt).toLocaleDateString()}`;
  }
  if (activity.type === "lead.message_generated" && typeof meta?.channel === "string") {
    return `${label} (${String(meta.channel).toLowerCase()})`;
  }
  return label;
}
