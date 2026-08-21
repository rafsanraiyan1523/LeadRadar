"use client";

import { Bookmark, BookmarkCheck, Check, Globe, MapPin, Phone, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/lib/lead-discovery-types";
import { estimateOpportunity, opportunityBadgeVariant } from "@/lib/opportunity-heuristic";

export function ResultCard({
  result,
  selected,
  checked,
  saved,
  onSelect,
  onHover,
  onToggleChecked,
  onSave,
  onView,
}: {
  result: SearchResult;
  selected: boolean;
  checked: boolean;
  saved: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  onToggleChecked: () => void;
  onSave: () => void;
  onView: () => void;
}) {
  const opportunity = estimateOpportunity(result);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "flex flex-col gap-2.5 rounded-md border p-3.5 text-left transition-colors cursor-pointer",
        selected ? "border-primary bg-primary/[0.04]" : "border-border hover:border-foreground/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggleChecked()}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5"
            aria-label={`Select ${result.businessName}`}
          />
          <div>
            <p className="font-medium leading-tight">{result.businessName}</p>
            <p className="text-sm text-muted-foreground">{result.category ?? "Business"}</p>
          </div>
        </div>
        <Badge variant={opportunityBadgeVariant(opportunity)} className="shrink-0">
          {opportunity === "HIGH"
            ? "High opportunity"
            : opportunity === "MEDIUM"
              ? "Medium"
              : "Low"}
        </Badge>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{result.address ?? result.city ?? "Address unavailable"}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-1">
          <Star className="size-3.5 text-amber-500" fill="currentColor" />
          {result.rating ? result.rating.toFixed(1) : "—"}
          {result.reviewCount !== null && (
            <span className="text-muted-foreground">({result.reviewCount})</span>
          )}
        </span>
        <StatePill
          icon={Globe}
          active={result.hasWebsite}
          activeLabel="Has website"
          inactiveLabel="No website"
        />
        <StatePill
          icon={Check}
          active={result.hasGoogleProfile}
          activeLabel="Google found"
          inactiveLabel="Not verified"
        />
        <StatePill
          icon={Phone}
          active={!!result.phone}
          activeLabel="Phone available"
          inactiveLabel="No phone"
        />
      </div>

      <div className="flex items-center gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={onView}>
          View
        </Button>
        <Button
          size="sm"
          variant={saved ? "secondary" : "outline"}
          onClick={onSave}
          disabled={saved}
          className="gap-1.5"
        >
          {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
          {saved ? "Saved" : "Save"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" disabled>
                Audit
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
        {result.googleMapsUri && (
          <Button size="sm" variant="ghost" asChild>
            <a href={result.googleMapsUri} target="_blank" rel="noreferrer">
              Open Maps
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function StatePill({
  icon: Icon,
  active,
  activeLabel,
  inactiveLabel,
}: {
  icon: typeof Globe;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {active ? <Icon className="size-3.5" /> : <X className="size-3.5" />}
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
