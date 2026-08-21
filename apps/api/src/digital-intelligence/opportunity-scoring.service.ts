import { Injectable } from '@nestjs/common';
import { getOpportunityLevel } from '@lead-radar/providers';
import { PrismaService } from '../prisma/prisma.service';
import type { OpportunityScoreBreakdown } from '@lead-radar/types';
import type { OpportunityScoreResult } from './types';

/**
 * OpportunityScoringService: the read side of the Overall Opportunity
 * Score. The formula itself (legitimacy from a verified Google profile +
 * digital-presence weakness) lives in
 * @lead-radar/providers/audit/opportunity-scoring and is documented in
 * docs/scoring.md; it's computed by the worker and persisted here so the
 * lead audit page never recomputes it from partial data.
 */
@Injectable()
export class OpportunityScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getForLead(leadId: string): Promise<OpportunityScoreResult | null> {
    const record = await this.prisma.opportunityScore.findUnique({
      where: { leadId },
    });
    if (!record) return null;

    const breakdown = record.breakdown as unknown as OpportunityScoreBreakdown;
    return {
      score: record.score,
      level: getOpportunityLevel(record.score),
      breakdown,
    };
  }
}
