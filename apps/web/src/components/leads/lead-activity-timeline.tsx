"use client";

import { useLeadActivities } from "@/hooks/use-crm";
import { describeActivity } from "@/lib/activity-labels";

export function LeadActivityTimeline({ leadId }: { leadId: string }) {
  const { data: activities, isLoading } = useLeadActivities(leadId);

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading activity…</p>;
  if (!activities || activities.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-2.5 border-l border-border pl-3.5">
      {activities.map((activity) => (
        <li key={activity.id} className="relative">
          <span className="absolute top-1 -left-[18px] size-1.5 rounded-full bg-primary" />
          <p className="text-sm">{describeActivity(activity)}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(activity.createdAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </li>
      ))}
    </ol>
  );
}
