import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "accent";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon
          className={cn("size-4", tone === "accent" ? "text-primary" : "text-muted-foreground")}
        />
      </div>
      <span className="font-heading text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
