import { CalendarClock, Globe, MapPin, Signal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime, isOverdue } from "@/lib/format";
import { describeActivity } from "@/lib/activity-labels";
import { WEBSITE_STATE_LABELS } from "@/lib/pipeline-config";
import type { LeadCardView } from "@/lib/crm-types";

function scoreTone(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 66) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (score >= 33) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
}

function websiteTone(state: LeadCardView["websiteState"]): string {
  if (state === "STRONG") return "text-emerald-600 dark:text-emerald-400";
  if (state === "AVERAGE") return "text-amber-600 dark:text-amber-400";
  if (state === "WEAK") return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

/**
 * Pure presentational card body — reused by the draggable pipeline card and
 * the plain grid cards on /app/leads and /app/saved, so the two surfaces
 * never visually drift from each other.
 */
export function LeadCardContent({ lead }: { lead: LeadCardView }) {
  const location = [lead.city, lead.country].filter(Boolean).join(", ") || lead.address;
  const overdue = !!lead.nextFollowUp && isOverdue(lead.nextFollowUp.dueAt);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{lead.businessName}</p>
          <p className="truncate text-xs text-muted-foreground">{lead.category ?? "Business"}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            scoreTone(lead.opportunityScore),
          )}
        >
          {lead.opportunityScore ?? "—"}
        </span>
      </div>

      {location && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{location}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Signal className="size-3" />
          {lead.contactabilityScore}
        </span>
        <span className={cn("flex items-center gap-1", websiteTone(lead.websiteState))}>
          <Globe className="size-3" />
          {WEBSITE_STATE_LABELS[lead.websiteState]}
        </span>
      </div>

      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="border-transparent px-1.5"
              style={
                tag.color
                  ? { backgroundColor: `${tag.color}1a`, color: tag.color }
                  : undefined
              }
            >
              {tag.name}
            </Badge>
          ))}
          {lead.tags.length > 3 && (
            <Badge variant="outline" className="px-1.5 text-muted-foreground">
              +{lead.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {(lead.lastActivity || lead.nextFollowUp) && (
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          <span className="truncate">
            {lead.lastActivity
              ? `${describeActivity({ type: lead.lastActivity.type, metadata: undefined })} · ${formatRelativeTime(lead.lastActivity.createdAt)}`
              : "No activity yet"}
          </span>
          {lead.nextFollowUp && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5",
                overdue
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              <CalendarClock className="size-3" />
              {formatRelativeTime(lead.nextFollowUp.dueAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
