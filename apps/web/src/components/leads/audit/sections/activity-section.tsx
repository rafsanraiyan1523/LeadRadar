import { History } from "lucide-react";
import { SectionCard } from "../section-card";
import { describeActivity } from "@/lib/activity-labels";
import type { LeadActivityView } from "@/lib/digital-intelligence-types";

export function ActivitySection({ activity }: { activity: LeadActivityView[] }) {
  return (
    <SectionCard title="Activity" icon={History}>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No activity recorded yet.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {activity.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute top-1 -left-[21px] size-2 rounded-full bg-primary" />
              <p className="text-sm">{describeActivity(item)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
