import { Badge } from "@/components/ui/badge";
import type { FindingSeverity } from "@/lib/digital-intelligence-types";

const CONFIG: Record<FindingSeverity, { label: string; className: string }> = {
  HIGH: { label: "High", className: "bg-destructive/10 text-destructive" },
  MEDIUM: { label: "Medium", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  LOW: { label: "Low", className: "bg-muted text-muted-foreground" },
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const config = CONFIG[severity];
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
