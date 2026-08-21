"use client";

import { AlertTriangle, Mail, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/leads/audit/section-card";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { CampaignDashboardStats } from "@/components/campaigns/campaign-dashboard-stats";
import {
  useCampaign,
  useCampaignDashboard,
  useGenerateCampaignMessages,
  useRemoveCampaignLead,
  useUpdateCampaign,
} from "@/hooks/use-campaigns";
import { ApiError } from "@/lib/api-error";
import { STATUS_LABELS } from "@/lib/pipeline-config";
import { CAMPAIGN_SERVICE_OPTIONS } from "@/lib/campaign-types";
import type { CampaignStatus } from "@/lib/campaign-types";

const STATUS_OPTIONS: CampaignStatus[] = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"];

export function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const { data: campaign, isLoading, isError } = useCampaign(campaignId);
  const { data: stats } = useCampaignDashboard(campaignId);
  const updateCampaign = useUpdateCampaign(campaignId);
  const removeLead = useRemoveCampaignLead(campaignId);
  const generateMessages = useGenerateCampaignMessages(campaignId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Couldn&apos;t load this campaign.</p>
      </div>
    );
  }

  const serviceLabel =
    CAMPAIGN_SERVICE_OPTIONS.find((o) => o.value === campaign.service)?.label ?? campaign.service;

  function handleGenerate() {
    generateMessages.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          result.generated > 0
            ? `Generated ${result.generated} message${result.generated === 1 ? "" : "s"}`
            : "No new messages to generate — every lead already has one",
        );
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Couldn't generate messages");
      },
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{campaign.name}</h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            {campaign.description && (
              <p className="mt-1 text-sm text-muted-foreground">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={campaign.status}
              onValueChange={(v) => updateCampaign.mutate({ status: v as CampaignStatus })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleGenerate} disabled={generateMessages.isPending} className="gap-1.5">
              <Sparkles className="size-4" />
              {generateMessages.isPending ? "Generating…" : "Generate messages"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{serviceLabel}</Badge>
          <Badge variant="outline">{campaign.tone.charAt(0) + campaign.tone.slice(1).toLowerCase()}</Badge>
          <Badge variant="outline">{campaign.channel}</Badge>
          {campaign.targetCategory && <Badge variant="outline">{campaign.targetCategory}</Badge>}
          {campaign.targetLocation && <Badge variant="outline">{campaign.targetLocation}</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {stats && (
          <SectionCard title="Campaign Dashboard" icon={Mail}>
            <CampaignDashboardStats stats={stats} />
          </SectionCard>
        )}

        <SectionCard title={`Leads (${campaign.leads.length})`} icon={Mail}>
          {campaign.leads.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No leads in this campaign yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {campaign.leads.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lead.businessName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.category ?? "—"} {lead.city ? `· ${lead.city}` : ""} · score{" "}
                      {lead.opportunityScore ?? "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{STATUS_LABELS[lead.leadStatus]}</Badge>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeLead.mutate(lead.id)}
                      aria-label={`Remove ${lead.businessName} from campaign`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
