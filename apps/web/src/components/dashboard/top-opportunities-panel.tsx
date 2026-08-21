import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RECOMMENDED_SERVICE_LABELS } from "@/lib/analytics-types";
import type { TopOpportunityRow } from "@/lib/analytics-types";

function scoreTone(score: number): string {
  if (score >= 66) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (score >= 33) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
}

export function TopOpportunitiesPanel({ opportunities }: { opportunities: TopOpportunityRow[] }) {
  if (opportunities.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No scored leads yet — audit a lead to see it here.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {opportunities.map((lead, i) => (
        <li key={lead.id}>
          <Link
            href={`/app/leads/${lead.id}`}
            className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:border-foreground/20"
          >
            <span className="w-4 shrink-0 text-center text-xs font-medium text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{lead.businessName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {lead.keyProblem ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangle className="size-3 shrink-0 text-amber-500" />
                    <span className="truncate">{lead.keyProblem}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">No issues detected</span>
                )}
                {lead.recommendedService && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {RECOMMENDED_SERVICE_LABELS[lead.recommendedService]}
                  </Badge>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreTone(lead.opportunityScore)}`}
            >
              {lead.opportunityScore}
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
