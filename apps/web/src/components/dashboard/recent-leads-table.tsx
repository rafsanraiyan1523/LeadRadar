import Link from "next/link";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { STATUS_LABELS, WEBSITE_STATE_LABELS } from "@/lib/pipeline-config";
import type { RecentLeadRow } from "@/lib/analytics-types";

function scoreTone(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 66) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 33) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function RecentLeadsTable({ leads }: { leads: RecentLeadRow[] }) {
  if (leads.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No leads yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Business</th>
            <th className="py-2 pr-3 font-medium">Category</th>
            <th className="py-2 pr-3 font-medium">Score</th>
            <th className="py-2 pr-3 font-medium">Website</th>
            <th className="py-2 pr-3 font-medium">Contactability</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border/60 last:border-0">
              <td className="py-2.5 pr-3 font-medium">
                <Link href={`/app/leads/${lead.id}`} className="hover:underline">
                  {lead.businessName}
                </Link>
              </td>
              <td className="py-2.5 pr-3 text-muted-foreground">{lead.category ?? "—"}</td>
              <td className={cn("py-2.5 pr-3 font-semibold tabular-nums", scoreTone(lead.opportunityScore))}>
                {lead.opportunityScore ?? "—"}
              </td>
              <td className="py-2.5 pr-3 text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="size-3.5" />
                  {WEBSITE_STATE_LABELS[lead.websiteState]}
                </span>
              </td>
              <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                {lead.contactabilityScore}
              </td>
              <td className="py-2.5 pr-3">
                <Badge variant="outline">{STATUS_LABELS[lead.leadStatus]}</Badge>
              </td>
              <td className="py-2.5 text-muted-foreground">{formatRelativeTime(lead.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
