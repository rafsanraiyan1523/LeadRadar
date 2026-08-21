"use client";

import Link from "next/link";
import { BarChart3, Bookmark, BookmarkCheck, ExternalLink, Globe, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ContactInfoPanel } from "@/components/leads/contact-info-panel";
import type { SearchResult } from "@/lib/lead-discovery-types";
import { estimateOpportunity, opportunityBadgeVariant } from "@/lib/opportunity-heuristic";
import { useEnrichLead, useLeadEnrichment } from "@/hooks/use-lead-enrichment";
import { ApiError } from "@/lib/api-error";

export function ResultDetailSheet({
  result,
  open,
  onOpenChange,
  saved,
  onSave,
}: {
  result: SearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: boolean;
  onSave: () => void;
}) {
  const leadId = result?.promotedToLeadId ?? null;
  const { data: enrichment } = useLeadEnrichment(leadId);
  const enrichMutation = useEnrichLead(leadId);

  if (!result) return null;
  const opportunity = estimateOpportunity(result);

  function handleEnrich() {
    enrichMutation.mutate(undefined, {
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : "Couldn't start enrichment");
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{result.businessName}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex items-center gap-2">
            <Badge variant={opportunityBadgeVariant(opportunity)}>
              {opportunity === "HIGH"
                ? "High opportunity"
                : opportunity === "MEDIUM"
                  ? "Medium opportunity"
                  : "Low opportunity"}
            </Badge>
            {result.businessStatus && result.businessStatus !== "OPERATIONAL" && (
              <Badge variant="destructive">{result.businessStatus.replace("_", " ")}</Badge>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">{result.category ?? "Business"}</p>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{result.address ?? "Address unavailable"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="size-4 shrink-0 text-amber-500" fill="currentColor" />
              <span>
                {result.rating ? result.rating.toFixed(1) : "No rating"}
                {result.reviewCount !== null && (
                  <span className="text-muted-foreground"> ({result.reviewCount} reviews)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <span>{result.phone ?? "No phone found"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              {result.websiteUrl ? (
                <a
                  href={result.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary underline-offset-4 hover:underline"
                >
                  {result.websiteUrl}
                </a>
              ) : (
                <span>No website found</span>
              )}
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2">
            <Button
              onClick={onSave}
              disabled={saved}
              variant={saved ? "secondary" : "default"}
              className="gap-1.5"
            >
              {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
              {saved ? "Saved" : "Save lead"}
            </Button>
            {result.googleMapsUri && (
              <Button variant="outline" asChild className="gap-1.5">
                <a href={result.googleMapsUri} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open in Google Maps
                </a>
              </Button>
            )}
          </div>

          {leadId && (
            <>
              <Separator />
              <Button variant="outline" asChild className="gap-1.5">
                <Link href={`/app/leads/${leadId}`}>
                  <BarChart3 className="size-4" />
                  View full digital intelligence audit
                </Link>
              </Button>
              {enrichment ? (
                <ContactInfoPanel
                  enrichment={enrichment}
                  onEnrich={handleEnrich}
                  isEnriching={enrichMutation.isPending}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading contact information…</p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
