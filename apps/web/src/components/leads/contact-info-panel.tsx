"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { buildContactChannels, type ContactChannel } from "@/lib/contact-channels";
import type { LeadEnrichment } from "@/lib/lead-enrichment-types";
import { cn } from "@/lib/utils";

function contactabilityColor(score: number): string {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function ContactChannelRow({ channel }: { channel: ContactChannel }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!channel.value) return;
    try {
      await navigator.clipboard.writeText(channel.value);
      setCopied(true);
      toast.success(`${channel.label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{channel.label}</span>
          {channel.value && channel.verified && (
            <Badge variant="secondary" className="gap-1 text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="size-3" />
              Verified
            </Badge>
          )}
        </div>
        {channel.value ? (
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={channel.value}>
            {channel.value}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground italic">Not found</p>
        )}
        {channel.source && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">Source: {channel.source}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={!channel.openHref}
          asChild={!!channel.openHref}
        >
          {channel.openHref ? (
            <a href={channel.openHref} target="_blank" rel="noreferrer" aria-label={`Open ${channel.label}`}>
              <ExternalLink className="size-4" />
            </a>
          ) : (
            <ExternalLink className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!channel.value}
          onClick={handleCopy}
          aria-label={`Copy ${channel.label}`}
        >
          <Copy className={cn("size-4", copied && "text-emerald-600 dark:text-emerald-400")} />
        </Button>
      </div>
    </div>
  );
}

export function ContactInfoPanel({
  enrichment,
  onEnrich,
  isEnriching,
}: {
  enrichment: LeadEnrichment;
  onEnrich?: () => void;
  isEnriching?: boolean;
}) {
  const channels = buildContactChannels(enrichment);
  const status = enrichment.enrichment.status;
  const isActive = status === "PENDING" || status === "RUNNING";

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Contactability Score</p>
          <p className={cn("text-2xl font-semibold tabular-nums", contactabilityColor(enrichment.contactability.score))}>
            {enrichment.contactability.score} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
          </p>
        </div>
        {onEnrich && (
          <Button variant="outline" size="sm" onClick={onEnrich} disabled={isActive || isEnriching} className="gap-1.5">
            {isActive || isEnriching ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {isActive ? `Enriching… ${enrichment.enrichment.progress}%` : "Starting…"}
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                {status === "NOT_STARTED" ? "Enrich" : "Re-enrich"}
              </>
            )}
          </Button>
        )}
      </div>

      {status === "FAILED" && enrichment.enrichment.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Enrichment failed: {enrichment.enrichment.error}
        </p>
      )}

      <Separator />

      <div className="divide-y">
        {channels.map((channel) => (
          <ContactChannelRow key={channel.key} channel={channel} />
        ))}
      </div>
    </div>
  );
}
