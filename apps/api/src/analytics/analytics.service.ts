import { Injectable } from '@nestjs/common';
import {
  calculateContactabilityScore,
  mapFindingsToRecommendedServices,
} from '@lead-radar/providers';
import type {
  FindingCategory,
  FindingSeverity,
  GrowthOpportunityFinding,
} from '@lead-radar/types';
import type { LeadStatus, Prisma } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import { buildContactabilitySignals } from '../leads/leads.service';
import { deriveWebsiteState } from '../crm/crm.service';
import type { AnalyticsFiltersDto } from './dto/analytics-filters.dto';
import type {
  AnalyticsResponse,
  ChartBucket,
  DashboardCharts,
  DashboardMetrics,
  DashboardResponse,
  RecentLeadRow,
  TopOpportunityRow,
} from './types';

/** "Reached at least this stage" ordinal for the cumulative Pipeline Funnel chart — LOST is shown as its own terminal bar, never folded into a stage it may never have reached. */
const FUNNEL_STAGES = [
  'SAVED',
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'MEETING',
  'PROPOSAL',
  'WON',
] as const;
const FUNNEL_LABELS: Record<(typeof FUNNEL_STAGES)[number], string> = {
  SAVED: 'New',
  CONTACTED: 'Contacted',
  REPLIED: 'Replied',
  INTERESTED: 'Interested',
  MEETING: 'Meeting',
  PROPOSAL: 'Proposal',
  WON: 'Won',
};
const ALL_STATUSES: LeadStatus[] = [
  'NEW',
  'SAVED',
  'CONTACTED',
  'REPLIED',
  'INTERESTED',
  'MEETING',
  'PROPOSAL',
  'WON',
  'LOST',
];
const SCORE_BUCKETS = [
  { label: '0-20', min: 0, max: 20 },
  { label: '21-40', min: 21, max: 40 },
  { label: '41-60', min: 41, max: 60 },
  { label: '61-80', min: 61, max: 80 },
  { label: '81-100', min: 81, max: 100 },
];
const SEVERITY_RANK: Record<FindingSeverity, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function funnelOrdinal(status: LeadStatus): number {
  if (status === 'NEW') return 0;
  const idx = FUNNEL_STAGES.indexOf(status as (typeof FUNNEL_STAGES)[number]);
  return idx === -1 ? -1 : idx;
}

function bucketScore(score: number | null): string {
  if (score === null) return 'Not scored';
  return (
    SCORE_BUCKETS.find((b) => score >= b.min && score <= b.max)?.label ??
    'Not scored'
  );
}

const CONTACTABILITY_INCLUDE = {
  contacts: true,
  socialProfiles: true,
  website: { select: { metadata: true } },
} satisfies Prisma.LeadInclude;

/**
 * Every figure here is computed live from the current org's `Lead`/
 * `WebsiteAudit`/`GrowthOpportunity`/`LeadActivity` rows at request time —
 * nothing is precomputed, cached, or hardcoded (see the ANALYTICS spec:
 * "Charts should use real database data" / "Do not hardcode dashboard
 * statistics"). `getDashboard` is the unfiltered /app snapshot (also
 * carrying recentLeads/topOpportunities); `getAnalytics` is the same
 * metrics/charts shape filtered for /app/analytics.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(organizationId: string): Promise<DashboardResponse> {
    const where: Prisma.LeadWhereInput = { organizationId };
    const [metrics, charts, recentLeads, topOpportunities] = await Promise.all([
      this.computeMetrics(where),
      this.computeCharts(where),
      this.getRecentLeads(organizationId),
      this.getTopOpportunities(organizationId),
    ]);
    return { metrics, charts, recentLeads, topOpportunities };
  }

  async getAnalytics(
    organizationId: string,
    filters: AnalyticsFiltersDto,
  ): Promise<AnalyticsResponse> {
    const where = this.buildWhere(organizationId, filters);
    const [metrics, charts] = await Promise.all([
      this.computeMetrics(where),
      this.computeCharts(where),
    ]);
    return { metrics, charts };
  }

  private buildWhere(
    organizationId: string,
    filters: AnalyticsFiltersDto,
  ): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = { organizationId };

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }
    if (filters.category) {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }
    if (filters.location) {
      where.OR = [
        { city: { contains: filters.location, mode: 'insensitive' } },
        { address: { contains: filters.location, mode: 'insensitive' } },
      ];
    }
    if (filters.status) {
      where.leadStatus = filters.status;
    }
    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      where.opportunityScore = {
        ...(filters.minScore !== undefined ? { gte: filters.minScore } : {}),
        ...(filters.maxScore !== undefined ? { lte: filters.maxScore } : {}),
      };
    }

    return where;
  }

  private async computeMetrics(
    where: Prisma.LeadWhereInput,
  ): Promise<DashboardMetrics> {
    const [statusCounts, totalLeads, highOpportunity] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['leadStatus'], where, _count: true }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({
        where: { AND: [where, { opportunityScore: { gte: 66 } }] },
      }),
    ]);

    const countFor = (status: LeadStatus) =>
      statusCounts.find((c) => c.leadStatus === status)?._count ?? 0;
    const won = countFor('WON');

    return {
      totalLeads,
      highOpportunity,
      saved: countFor('NEW') + countFor('SAVED'),
      contacted: countFor('CONTACTED'),
      replies: countFor('REPLIED'),
      meetings: countFor('MEETING'),
      won,
      conversionRate: totalLeads > 0 ? won / totalLeads : 0,
    };
  }

  private async computeCharts(
    where: Prisma.LeadWhereInput,
  ): Promise<DashboardCharts> {
    const [
      statusCounts,
      scoreRows,
      dateRows,
      categoryGroups,
      locationGroups,
      contactabilityLeads,
    ] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['leadStatus'], where, _count: true }),
      this.prisma.lead.findMany({ where, select: { opportunityScore: true } }),
      this.prisma.lead.findMany({
        where:
          'createdAt' in where
            ? where
            : { ...where, createdAt: { gte: thirtyDaysAgo() } },
        select: { createdAt: true },
      }),
      this.prisma.lead.groupBy({
        by: ['category'],
        where: { ...where, category: { not: null } },
        _count: true,
      }),
      this.prisma.lead.groupBy({
        by: ['city'],
        where: { ...where, city: { not: null } },
        _count: true,
      }),
      this.prisma.lead.findMany({ where, include: CONTACTABILITY_INCLUDE }),
    ]);

    const countFor = (status: LeadStatus) =>
      statusCounts.find((c) => c.leadStatus === status)?._count ?? 0;

    const pipelineFunnel: ChartBucket[] = FUNNEL_STAGES.map((stage, idx) => ({
      label: FUNNEL_LABELS[stage],
      count: ALL_STATUSES.filter(
        (s) => s !== 'LOST' && funnelOrdinal(s) >= idx,
      ).reduce((sum, s) => sum + countFor(s), 0),
    }));
    pipelineFunnel.push({ label: 'Lost', count: countFor('LOST') });

    const leadStatus = ALL_STATUSES.map((status) => ({
      status,
      count: countFor(status),
    }));

    const scoreDistribution = new Map<string, number>();
    for (const row of scoreRows) {
      const bucket = bucketScore(row.opportunityScore);
      scoreDistribution.set(bucket, (scoreDistribution.get(bucket) ?? 0) + 1);
    }
    const opportunityDistribution = [
      ...SCORE_BUCKETS.map((b) => b.label),
      'Not scored',
    ].map((label) => ({ label, count: scoreDistribution.get(label) ?? 0 }));

    const dayCounts = new Map<string, number>();
    for (const row of dateRows) {
      const day = row.createdAt.toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
    const leadDiscoveryTrend = [...dayCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const topCategories = categoryGroups
      .map((g) => ({ label: g.category as string, count: g._count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    const topLocations = locationGroups
      .map((g) => ({ label: g.city as string, count: g._count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const scored = scoreRows
      .map((r) => r.opportunityScore)
      .filter((s): s is number => s !== null);
    const avgOpportunityScore =
      scored.length > 0
        ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
        : null;

    const contactabilityScores = contactabilityLeads.map(
      (lead) =>
        calculateContactabilityScore(
          buildContactabilitySignals(
            lead,
            lead.contacts,
            lead.socialProfiles,
            lead.website?.metadata ?? null,
          ),
        ).score,
    );
    const contactabilityAvg =
      contactabilityScores.length > 0
        ? Math.round(
            contactabilityScores.reduce((a, b) => a + b, 0) /
              contactabilityScores.length,
          )
        : 0;
    const contactabilityBuckets = new Map<string, number>();
    for (const score of contactabilityScores) {
      const bucket = bucketScore(score);
      contactabilityBuckets.set(
        bucket,
        (contactabilityBuckets.get(bucket) ?? 0) + 1,
      );
    }
    const contactabilityDistribution = SCORE_BUCKETS.map((b) => ({
      label: b.label,
      count: contactabilityBuckets.get(b.label) ?? 0,
    }));

    return {
      leadDiscoveryTrend,
      opportunityDistribution,
      pipelineFunnel,
      leadStatus,
      topCategories,
      topLocations,
      avgOpportunityScore,
      contactability: {
        average: contactabilityAvg,
        distribution: contactabilityDistribution,
      },
    };
  }

  private async getRecentLeads(
    organizationId: string,
  ): Promise<RecentLeadRow[]> {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        ...CONTACTABILITY_INCLUDE,
        websiteAudits: { orderBy: { auditedAt: 'desc' }, take: 1 },
      },
    });

    return leads.map((lead) => ({
      id: lead.id,
      businessName: lead.businessName,
      category: lead.category,
      opportunityScore: lead.opportunityScore,
      websiteUrl: lead.websiteUrl,
      websiteState: deriveWebsiteState(
        lead.websiteUrl,
        lead.websiteAudits[0]?.websiteScore ?? null,
      ),
      contactabilityScore: calculateContactabilityScore(
        buildContactabilitySignals(
          lead,
          lead.contacts,
          lead.socialProfiles,
          lead.website?.metadata ?? null,
        ),
      ).score,
      leadStatus: lead.leadStatus,
      createdAt: lead.createdAt.toISOString(),
    }));
  }

  /** TOP OPPORTUNITIES — top 10 by score, each with its highest-severity detected finding and the (rule-based, never AI-invented) service it justifies. */
  private async getTopOpportunities(
    organizationId: string,
  ): Promise<TopOpportunityRow[]> {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, opportunityScore: { not: null } },
      orderBy: { opportunityScore: 'desc' },
      take: 10,
      include: { growthOpportunities: true },
    });

    return leads.map((lead) => {
      const findings: GrowthOpportunityFinding[] = lead.growthOpportunities.map(
        (g) => ({
          title: g.title,
          category: g.type as FindingCategory,
          severity: g.impact,
          evidence: g.evidence,
          recommendation: g.recommendation,
        }),
      );
      const topFinding = [...findings].sort(
        (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
      )[0];
      const recommended =
        mapFindingsToRecommendedServices(findings)[0]?.service ?? null;

      return {
        id: lead.id,
        businessName: lead.businessName,
        opportunityScore: lead.opportunityScore as number,
        keyProblem: topFinding?.title ?? null,
        recommendedService: recommended,
      };
    });
  }
}

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 86_400_000);
}
