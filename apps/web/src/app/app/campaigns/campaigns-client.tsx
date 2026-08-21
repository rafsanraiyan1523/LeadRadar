"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CreateCampaignSheet } from "@/components/campaigns/create-campaign-sheet";
import { useCampaigns } from "@/hooks/use-campaigns";

export function CampaignsClient() {
  const router = useRouter();
  const { data: campaigns, isLoading, isError } = useCampaigns();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Group leads by service and reach out in bulk — messages are always drafts you send yourself.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-1.5">
          <Plus className="size-4" />
          New campaign
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : isError || !campaigns ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Couldn&apos;t load campaigns. Try refreshing.</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-muted-foreground">
            <p>No campaigns yet.</p>
            <p className="text-sm">Create one to group leads and generate outreach in bulk.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>

      <CreateCampaignSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => router.push(`/app/campaigns/${id}`)}
      />
    </div>
  );
}
