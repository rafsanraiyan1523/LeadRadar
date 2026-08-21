import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { WebsiteAuditSignalsJson, WebsiteAuditView } from './types';

function isSignalsJson(value: unknown): value is WebsiteAuditSignalsJson {
  return !!value && typeof value === 'object' && 'seo' in value;
}

/**
 * WebsiteAuditService: the read side of the Digital Intelligence Engine's
 * website checks (HTTPS, SEO, mobile, conversion, technical, performance,
 * broken links). The engine's actual computation runs in the worker
 * (packages/providers/src/audit + apps/worker/src/jobs/lead-enrichment.processor)
 * against a real crawl; this service formats the latest persisted result for
 * the lead audit page. Every number here is a LeadRadar check, never a
 * PageSpeed/Lighthouse score.
 */
@Injectable()
export class WebsiteAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getForLead(leadId: string): Promise<WebsiteAuditView | null> {
    const [website, audit] = await Promise.all([
      this.prisma.leadWebsite.findUnique({ where: { leadId } }),
      this.prisma.websiteAudit.findFirst({
        where: { leadId },
        orderBy: { auditedAt: 'desc' },
      }),
    ]);

    if (!audit) return null;

    const signals = isSignalsJson(audit.signals) ? audit.signals : null;

    return {
      websiteScore: audit.websiteScore,
      seoScore: audit.seoScore,
      mobileScore: audit.mobileScore,
      conversionScore: audit.conversionScore,
      technicalScore: audit.technicalScore,
      accessibilityScore: audit.accessibilityScore,
      hasSsl: audit.hasSsl,
      isMobileFriendly: audit.isMobileFriendly,
      techStack: audit.techStack,
      issues: Array.isArray(audit.issues) ? (audit.issues as string[]) : [],
      url: website?.url ?? null,
      pagesCrawled: website?.pagesCrawled ?? null,
      lastCheckedAt: website?.lastCheckedAt?.toISOString() ?? null,
      auditedAt: audit.auditedAt.toISOString(),
      performance: signals?.performance ?? null,
      brokenLinksChecked: signals?.brokenLinksChecked ?? null,
      brokenLinksFound: signals?.brokenLinksFound ?? null,
    };
  }
}
