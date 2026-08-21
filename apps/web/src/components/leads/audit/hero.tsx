"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Phone, RefreshCw, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "./score-ring";
import { opportunityBadgeVariant } from "@/lib/opportunity-heuristic";
import type { LeadAuditResponse } from "@/lib/digital-intelligence-types";
import { cn } from "@/lib/utils";

const ACTIVE_STATUSES = new Set(["PENDING", "RUNNING"]);

export function LeadAuditHero({
  data,
  onEnrich,
  isEnriching,
}: {
  data: LeadAuditResponse;
  onEnrich: () => void;
  isEnriching: boolean;
}) {
  const { lead, opportunity, conversion } = data;
  const location = [lead.address, lead.city, lead.country].filter(Boolean).join(", ");
  const isActive = ACTIVE_STATUSES.has(lead.enrichmentStatus) || isEnriching;

  return (
    <div className="flex flex-col gap-6 border-b border-border bg-card px-4 py-6 sm:px-6">
      <Link
        href="/app/find"
        className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Find
      </Link>

      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-5">
          <ScoreRing score={opportunity?.score ?? null} size="lg" tone="opportunity" label="Opportunity" />
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">{lead.businessName}</h1>
              {opportunity && (
                <Badge variant={opportunityBadgeVariant(opportunity.level)}>
                  {opportunity.level === "HIGH"
                    ? "High opportunity"
                    : opportunity.level === "MEDIUM"
                      ? "Medium opportunity"
                      : "Low opportunity"}
                </Badge>
              )}
              {lead.businessStatus && lead.businessStatus !== "OPERATIONAL" && (
                <Badge variant="destructive">{lead.businessStatus.replace(/_/g, " ")}</Badge>
              )}
            </div>
            {lead.category && <p className="text-sm text-muted-foreground">{lead.category}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" />
                  {location}
                </span>
              )}
              {lead.rating !== null && (
                <span className="flex items-center gap-1.5">
                  <Star className="size-3.5 shrink-0 text-amber-500" fill="currentColor" />
                  {lead.rating.toFixed(1)}
                  {lead.reviewCount !== null && ` (${lead.reviewCount})`}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" />
                Contactability {conversion.contactability.score}/100
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <Button onClick={onEnrich} disabled={isActive} className="gap-1.5">
            {isActive ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {lead.enrichmentStatus === "RUNNING"
                  ? `Auditing… ${lead.enrichmentProgress}%`
                  : "Starting…"}
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                {lead.enrichmentStatus === "NOT_STARTED" ? "Run digital intelligence audit" : "Re-audit"}
              </>
            )}
          </Button>
          {lead.lastEnrichedAt && (
            <p className="text-xs text-muted-foreground">
              Last audited {new Date(lead.lastEnrichedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          {lead.enrichmentStatus === "FAILED" && lead.enrichmentError && (
            <p className={cn("max-w-xs text-right text-xs text-destructive")}>{lead.enrichmentError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
