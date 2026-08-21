"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadAudit } from "@/hooks/use-lead-audit";
import { useEnrichLead } from "@/hooks/use-lead-enrichment";
import { ApiError } from "@/lib/api-error";
import { LeadAuditHero } from "@/components/leads/audit/hero";
import { OverviewSection } from "@/components/leads/audit/sections/overview-section";
import { ContactSection } from "@/components/leads/audit/sections/contact-section";
import { CrmSection } from "@/components/leads/audit/sections/crm-section";
import { GoogleBusinessSection } from "@/components/leads/audit/sections/google-business-section";
import { WebsiteSection } from "@/components/leads/audit/sections/website-section";
import { SeoSection } from "@/components/leads/audit/sections/seo-section";
import { ConversionSection } from "@/components/leads/audit/sections/conversion-section";
import { SocialSection } from "@/components/leads/audit/sections/social-section";
import { GrowthOpportunitiesSection } from "@/components/leads/audit/sections/growth-opportunities-section";
import { AiInsightSection } from "@/components/leads/audit/sections/ai-insight-section";
import { OutreachSection } from "@/components/leads/audit/sections/outreach-section";
import { ActivitySection } from "@/components/leads/audit/sections/activity-section";

export function LeadDetailClient({ leadId }: { leadId: string }) {
  const { data, isLoading, isError, error } = useLeadAudit(leadId);
  const enrichMutation = useEnrichLead(leadId);
  const searchParams = useSearchParams();
  const crmSectionRef = useRef<HTMLDivElement>(null);
  const wantsOpenNotes = searchParams.get("openNotes") === "1";

  useEffect(() => {
    if (wantsOpenNotes && data) {
      crmSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [wantsOpenNotes, data]);

  function handleEnrich() {
    enrichMutation.mutate(undefined, {
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Couldn't start the audit");
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.statusCode === 404;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">{notFound ? "Lead not found" : "Couldn't load this lead"}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {notFound
            ? "This lead doesn't exist or isn't in your organization."
            : "Something went wrong loading this lead's digital intelligence profile. Try refreshing."}
        </p>
      </div>
    );
  }

  const hasWebsite = !!data.lead.websiteUrl;

  return (
    <div className="flex flex-col">
      <LeadAuditHero data={data} onEnrich={handleEnrich} isEnriching={enrichMutation.isPending} />

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <OverviewSection data={data} />
          <WebsiteSection website={data.website} websiteUrl={data.lead.websiteUrl} />
          <SeoSection seo={data.seo} hasWebsite={hasWebsite} />
          <ConversionSection conversion={data.conversion} hasWebsite={hasWebsite} />
          <GrowthOpportunitiesSection findings={data.growthOpportunities} />
        </div>

        <div className="flex flex-col gap-4">
          <ContactSection data={data} />
          <CrmSection ref={crmSectionRef} leadId={leadId} status={data.lead.leadStatus} />
          <GoogleBusinessSection data={data.googleBusiness} />
          <SocialSection profiles={data.social} />
          <AiInsightSection leadId={leadId} />
          <OutreachSection
            leadId={leadId}
            phone={data.lead.phone}
            email={data.lead.email}
            websiteUrl={data.lead.websiteUrl}
            facebookUrl={data.social.find((s) => s.platform === "FACEBOOK")?.url ?? null}
          />
          <ActivitySection activity={data.activity} />
        </div>
      </div>
    </div>
  );
}
