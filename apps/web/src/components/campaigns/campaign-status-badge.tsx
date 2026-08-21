import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/lib/campaign-types";

const VARIANTS: Record<CampaignStatus, "default" | "secondary" | "outline"> = {
  DRAFT: "outline",
  ACTIVE: "default",
  PAUSED: "secondary",
  COMPLETED: "secondary",
};

const LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
