import { Injectable } from '@nestjs/common';
import { calculateContactabilityScore } from '@lead-radar/providers';
import { PrismaService } from '../prisma/prisma.service';
import { buildContactabilitySignals } from '../leads/leads.service';
import type { ConversionAuditView, WebsiteAuditSignalsJson } from './types';

function isSignalsJson(value: unknown): value is WebsiteAuditSignalsJson {
  return !!value && typeof value === 'object' && 'conversion' in value;
}

/**
 * ConversionAuditService: how easy the site makes it to actually get in
 * touch (CTAs, visible phone/email, booking, contact/service pages) plus
 * the live Contactability Score, which also folds in phone/email/social
 * known from Google Places or manual entry — not just what the site shows.
 */
@Injectable()
export class ConversionAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getForLead(leadId: string): Promise<ConversionAuditView> {
    const [lead, audit, contacts, socialProfiles, website] = await Promise.all([
      this.prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
      this.prisma.websiteAudit.findFirst({
        where: { leadId },
        orderBy: { auditedAt: 'desc' },
      }),
      this.prisma.leadContact.findMany({ where: { leadId } }),
      this.prisma.leadSocialProfile.findMany({ where: { leadId } }),
      this.prisma.leadWebsite.findUnique({ where: { leadId } }),
    ]);

    const signals =
      audit && isSignalsJson(audit.signals) ? audit.signals : null;
    const contactabilitySignals = buildContactabilitySignals(
      lead,
      contacts,
      socialProfiles,
      website?.metadata ?? null,
    );
    const contactability = calculateContactabilityScore(contactabilitySignals);

    return {
      score: audit?.conversionScore ?? null,
      breakdown: signals?.conversion?.breakdown ?? null,
      contactability,
    };
  }
}
