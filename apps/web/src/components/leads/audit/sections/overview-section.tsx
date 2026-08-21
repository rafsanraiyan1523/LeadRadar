import { Building2 } from "lucide-react";
import { SectionCard } from "../section-card";
import { MetricCard } from "../metric-card";
import type { LeadAuditResponse } from "@/lib/digital-intelligence-types";

export function OverviewSection({ data }: { data: LeadAuditResponse }) {
  const { lead, opportunity } = data;

  return (
    <SectionCard title="Overview" icon={Building2}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Website" score={data.website?.websiteScore ?? null} />
        <MetricCard label="SEO" score={data.seo?.score ?? null} />
        <MetricCard label="Conversion" score={data.conversion.score} />
        <MetricCard label="Google Profile" score={data.googleBusiness.score} />
      </div>
      <p className="text-sm text-muted-foreground">
        {opportunity
          ? summarize(lead.businessName, opportunity.level, data)
          : `${lead.businessName} hasn't been audited yet — run Enrich to generate its digital intelligence profile.`}
      </p>
    </SectionCard>
  );
}

function summarize(
  name: string,
  level: "HIGH" | "MEDIUM" | "LOW",
  data: LeadAuditResponse,
): string {
  const gaps: string[] = [];
  if (!data.lead.websiteUrl) gaps.push("no website");
  if (data.googleBusiness.status === "NOT_FOUND_IN_CURRENT_SEARCH") gaps.push("no Google Business profile found");
  if (data.conversion.score !== null && data.conversion.score < 50) gaps.push("weak conversion paths");
  if (data.seo?.score !== null && data.seo?.score !== undefined && data.seo.score < 50) gaps.push("weak SEO");

  const strengths: string[] = [];
  if (data.googleBusiness.signals?.rating && data.googleBusiness.signals.rating >= 4) {
    strengths.push(`a ${data.googleBusiness.signals.rating.toFixed(1)}★ Google rating`);
  }
  if (data.googleBusiness.signals?.userRatingCount) {
    strengths.push(`${data.googleBusiness.signals.userRatingCount} reviews`);
  }

  const levelLabel = level === "HIGH" ? "a high" : level === "MEDIUM" ? "a medium" : "a low";
  const strengthText = strengths.length > 0 ? ` with ${strengths.join(" and ")}` : "";
  const gapText = gaps.length > 0 ? ` Gaps: ${gaps.join(", ")}.` : " No major gaps detected.";

  return `${name} is${strengthText} an established business, scoring ${levelLabel} opportunity for outreach.${gapText}`;
}
