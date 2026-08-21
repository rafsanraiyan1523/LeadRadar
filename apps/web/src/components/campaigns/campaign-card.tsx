import Link from "next/link";
import { MessageSquare, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge } from "./campaign-status-badge";
import { CAMPAIGN_SERVICE_OPTIONS } from "@/lib/campaign-types";
import type { CampaignListItem } from "@/lib/campaign-types";

export function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const serviceLabel =
    CAMPAIGN_SERVICE_OPTIONS.find((o) => o.value === campaign.service)?.label ?? campaign.service;

  return (
    <Link
      href={`/app/campaigns/${campaign.id}`}
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{campaign.name}</p>
        <CampaignStatusBadge status={campaign.status} />
      </div>
      {campaign.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{serviceLabel}</Badge>
        {campaign.targetCategory && <Badge variant="outline">{campaign.targetCategory}</Badge>}
        {campaign.targetLocation && <Badge variant="outline">{campaign.targetLocation}</Badge>}
      </div>
      <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {campaign.leadCount} leads
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3.5" />
          {campaign.messageCount} messages
        </span>
        <span className="ml-auto">{new Date(campaign.createdAt).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}
