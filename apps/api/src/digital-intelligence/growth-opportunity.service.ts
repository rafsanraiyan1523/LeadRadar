import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FindingCategory, FindingSeverity } from '@lead-radar/types';

export interface GrowthOpportunityView {
  id: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  evidence: string;
  recommendation: string;
}

/**
 * GrowthOpportunityService: the read side of the structured findings the
 * worker generates each audit run (see
 * @lead-radar/providers/audit/growth-opportunities). Replaced wholesale on
 * every audit — this is current state, not a history log.
 */
@Injectable()
export class GrowthOpportunityService {
  constructor(private readonly prisma: PrismaService) {}

  async getForLead(leadId: string): Promise<GrowthOpportunityView[]> {
    const rows = await this.prisma.growthOpportunity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.type as FindingCategory,
      severity: row.impact,
      evidence: row.evidence,
      recommendation: row.recommendation,
    }));
  }
}
