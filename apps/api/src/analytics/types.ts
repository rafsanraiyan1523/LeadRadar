import type { LeadStatus } from '@lead-radar/db';
import type { RecommendedServiceType } from '@lead-radar/types';
import type { WebsiteState } from '../crm/types';

export interface DashboardMetrics {
  totalLeads: number;
  highOpportunity: number;
  saved: number;
  contacted: number;
  replies: number;
  meetings: number;
  won: number;
  conversionRate: number;
}

export interface ChartBucket {
  label: string;
  count: number;
}

export interface DashboardCharts {
  leadDiscoveryTrend: { date: string; count: number }[];
  opportunityDistribution: ChartBucket[];
  pipelineFunnel: ChartBucket[];
  leadStatus: { status: LeadStatus; count: number }[];
  topCategories: ChartBucket[];
  topLocations: ChartBucket[];
  avgOpportunityScore: number | null;
  contactability: { average: number; distribution: ChartBucket[] };
}

export interface RecentLeadRow {
  id: string;
  businessName: string;
  category: string | null;
  opportunityScore: number | null;
  websiteUrl: string | null;
  websiteState: WebsiteState;
  contactabilityScore: number;
  leadStatus: LeadStatus;
  createdAt: string;
}

export interface TopOpportunityRow {
  id: string;
  businessName: string;
  opportunityScore: number;
  keyProblem: string | null;
  recommendedService: RecommendedServiceType | null;
}

export interface DashboardResponse {
  metrics: DashboardMetrics;
  charts: DashboardCharts;
  recentLeads: RecentLeadRow[];
  topOpportunities: TopOpportunityRow[];
}

export interface AnalyticsResponse {
  metrics: DashboardMetrics;
  charts: DashboardCharts;
}
