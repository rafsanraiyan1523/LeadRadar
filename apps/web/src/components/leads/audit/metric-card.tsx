import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function MetricCard({
  label,
  score,
  icon: Icon,
  detail,
}: {
  label: string;
  /** null renders "Not audited" instead of a number — never a fabricated 0. */
  score: number | null;
  icon?: LucideIcon;
  detail?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      {score === null ? (
        <span className="text-sm text-muted-foreground italic">Not audited</span>
      ) : (
        <span className={cn("text-xl font-semibold tabular-nums", scoreColor(score))}>
          {score}
          <span className="text-xs font-normal text-muted-foreground"> / 100</span>
        </span>
      )}
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}
