"use client";

import { AlertTriangle, BarChart3, Download, Filter, History, MapPin, Signal, Star, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/leads/audit/section-card";
import { DashboardMetricsGrid } from "@/components/dashboard/dashboard-metrics-grid";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { ScoreDistributionChart } from "@/components/dashboard/score-distribution-chart";
import { PipelineFunnelChart } from "@/components/dashboard/pipeline-funnel-chart";
import { LeadStatusChart } from "@/components/dashboard/lead-status-chart";
import { RankedBarChart } from "@/components/dashboard/ranked-bar-chart";
import { ScoreStatCard } from "@/components/dashboard/score-stat-card";
import { RecentLeadsTable } from "@/components/dashboard/recent-leads-table";
import { TopOpportunitiesPanel } from "@/components/dashboard/top-opportunities-panel";
import { useDashboard } from "@/hooks/use-analytics";
import { useCurrentUser } from "@/hooks/use-auth";
import { getGreeting } from "@/lib/greeting";
import { API_BASE_URL } from "@/lib/api-client";

export function DashboardClient() {
  const { data: user } = useCurrentUser();
  const { data, isLoading, isError } = useDashboard();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-5 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {getGreeting()}
          {user ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">Find your next client.</p>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {isLoading ? (
          <DashboardSkeleton />
        ) : isError || !data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <AlertTriangle className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Couldn&apos;t load the dashboard. Try refreshing.</p>
          </div>
        ) : (
          <>
            <DashboardMetricsGrid metrics={data.metrics} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard title="Lead Discovery Trend" icon={History} className="lg:col-span-2">
                <TrendChart data={data.charts.leadDiscoveryTrend} />
              </SectionCard>

              <SectionCard title="Opportunity Distribution" icon={Star}>
                <ScoreDistributionChart data={data.charts.opportunityDistribution} />
              </SectionCard>

              <SectionCard title="Pipeline Funnel" icon={Filter}>
                <PipelineFunnelChart data={data.charts.pipelineFunnel} />
              </SectionCard>

              <SectionCard title="Lead Status" icon={BarChart3} className="lg:col-span-2">
                <LeadStatusChart data={data.charts.leadStatus} />
              </SectionCard>

              <SectionCard title="Top Business Categories" icon={BarChart3}>
                {data.charts.topCategories.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <RankedBarChart data={data.charts.topCategories} />
                )}
              </SectionCard>

              <SectionCard title="Top Locations" icon={MapPin}>
                {data.charts.topLocations.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <RankedBarChart data={data.charts.topLocations} />
                )}
              </SectionCard>

              <SectionCard title="Average Opportunity Score" icon={Star}>
                <ScoreStatCard label="Opportunity" score={data.charts.avgOpportunityScore} />
              </SectionCard>

              <SectionCard title="Contactability" icon={Signal}>
                <ScoreStatCard
                  label="Contactability"
                  score={data.charts.contactability.average}
                  detail={`${data.charts.contactability.distribution.reduce((s, b) => s + b.count, 0)} leads scored`}
                />
              </SectionCard>
            </div>

            <SectionCard
              title="Recent Leads"
              icon={History}
              action={
                <Button variant="outline" size="sm" asChild>
                  <a href={`${API_BASE_URL}/leads/export`}>
                    <Download className="size-3.5" />
                    Export CSV
                  </a>
                </Button>
              }
            >
              <RecentLeadsTable leads={data.recentLeads} />
            </SectionCard>

            <SectionCard title="Top Opportunities" icon={Trophy}>
              <TopOpportunitiesPanel opportunities={data.topOpportunities} />
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Not enough data yet.</p>;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
