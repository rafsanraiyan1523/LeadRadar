"use client";

import { useState } from "react";
import { ChevronDown, Globe, ShieldCheck, ShieldX, Smartphone } from "lucide-react";
import { SectionCard } from "../section-card";
import { ScoreRing } from "../score-ring";
import { MetricCard } from "../metric-card";
import { cn } from "@/lib/utils";
import type { WebsiteAuditView } from "@/lib/digital-intelligence-types";

export function WebsiteSection({ website, websiteUrl }: { website: WebsiteAuditView | null; websiteUrl: string | null }) {
  const [showIssues, setShowIssues] = useState(false);

  if (!websiteUrl) {
    return (
      <SectionCard title="Website" icon={Globe}>
        <p className="text-sm text-muted-foreground italic">No website detected for this business.</p>
      </SectionCard>
    );
  }

  if (!website) {
    return (
      <SectionCard title="Website" icon={Globe}>
        <p className="truncate text-sm text-primary">{websiteUrl}</p>
        <p className="text-sm text-muted-foreground">Not audited yet — run Enrich to check this site.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Website" icon={Globe}>
      <div className="flex items-start gap-4">
        <ScoreRing score={website.websiteScore} size="md" label="/100" />
        <div className="flex flex-1 flex-col gap-1.5">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm text-primary underline-offset-4 hover:underline"
          >
            {websiteUrl}
          </a>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {website.hasSsl ? (
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ShieldX className="size-3.5 text-destructive" />
              )}
              {website.hasSsl ? "HTTPS" : "No HTTPS"}
            </span>
            <span className="flex items-center gap-1">
              <Smartphone className="size-3.5" />
              {website.isMobileFriendly ? "Mobile-friendly viewport" : "No responsive viewport"}
            </span>
            {website.pagesCrawled !== null && <span>{website.pagesCrawled} page(s) crawled</span>}
          </div>
          {website.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {website.techStack.map((tech) => (
                <span key={tech} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Mobile" score={website.mobileScore} />
        <MetricCard label="Technical" score={website.technicalScore} />
        <MetricCard label="Accessibility" score={website.accessibilityScore} />
        <MetricCard
          label="Broken links"
          score={
            website.brokenLinksChecked
              ? Math.round(100 - ((website.brokenLinksFound ?? 0) / website.brokenLinksChecked) * 100)
              : null
          }
          detail={
            website.brokenLinksChecked
              ? `${website.brokenLinksFound ?? 0} of ${website.brokenLinksChecked} checked`
              : undefined
          }
        />
      </div>

      {website.performance && website.performance.homepageResponseTimeMs !== null && (
        <p className="text-xs text-muted-foreground">
          LeadRadar check: homepage responded in {website.performance.homepageResponseTimeMs}ms
          {website.performance.homepageSizeBytes !== null &&
            ` (${Math.round(website.performance.homepageSizeBytes / 1024)} KB)`}
          . Not a PageSpeed/Lighthouse score.
        </p>
      )}

      {website.issues.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIssues((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", showIssues && "rotate-180")} />
            {website.issues.length} technical issue{website.issues.length === 1 ? "" : "s"} found
          </button>
          {showIssues && (
            <ul className="mt-2 flex flex-col gap-1 border-l-2 border-border pl-3 text-xs text-muted-foreground">
              {website.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}
