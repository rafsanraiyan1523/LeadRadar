import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SeoAuditView, WebsiteAuditSignalsJson } from './types';

function isSignalsJson(value: unknown): value is WebsiteAuditSignalsJson {
  return !!value && typeof value === 'object' && 'seo' in value;
}

/**
 * SEOAuditService: the read side of the SEO checks (title, meta description,
 * H1, canonical, viewport, sitemap, structured data, Open Graph, robots) —
 * see @lead-radar/providers/audit/seo-audit for the actual scoring formula.
 */
@Injectable()
export class SeoAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getForLead(leadId: string): Promise<SeoAuditView | null> {
    const audit = await this.prisma.websiteAudit.findFirst({
      where: { leadId },
      orderBy: { auditedAt: 'desc' },
    });
    if (!audit) return null;

    const signals = isSignalsJson(audit.signals) ? audit.signals : null;
    return {
      score: audit.seoScore,
      breakdown: signals?.seo?.breakdown ?? null,
    };
  }
}
