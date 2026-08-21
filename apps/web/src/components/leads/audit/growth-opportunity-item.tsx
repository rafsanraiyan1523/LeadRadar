"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SeverityBadge } from "./severity-badge";
import { cn } from "@/lib/utils";
import type { GrowthOpportunityView } from "@/lib/digital-intelligence-types";

const CATEGORY_LABELS: Record<string, string> = {
  website: "Website",
  seo: "SEO",
  conversion: "Conversion",
  mobile: "Mobile",
  technical: "Technical",
  "google-business": "Google Business",
  social: "Social",
  content: "Content",
};

export function GrowthOpportunityItem({ finding }: { finding: GrowthOpportunityView }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <SeverityBadge severity={finding.severity} />
          <span className="truncate text-sm font-medium">{finding.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {CATEGORY_LABELS[finding.category] ?? finding.category}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-3.5 py-3 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Evidence</p>
            <p className="mt-0.5 text-foreground/90">{finding.evidence}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Recommendation</p>
            <p className="mt-0.5 text-foreground/90">{finding.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
