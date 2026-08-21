import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { calculateContactabilityScore } from '@lead-radar/providers';
import type {
  ContactabilitySignals,
  LeadEnrichmentJobData,
  WebsiteExtraction,
} from '@lead-radar/types';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_ENRICHMENT_QUEUE_TOKEN } from '../queue/queue.module';

const ACTIVE_ENRICHMENT_STATUSES = ['PENDING', 'RUNNING'] as const;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LEAD_ENRICHMENT_QUEUE_TOKEN)
    private readonly enrichmentQueue: Queue<LeadEnrichmentJobData>,
  ) {}

  async enrichLead(organizationId: string, userId: string, leadId: string) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);

    if (
      ACTIVE_ENRICHMENT_STATUSES.includes(
        lead.enrichmentStatus as (typeof ACTIVE_ENRICHMENT_STATUSES)[number],
      )
    ) {
      return {
        leadId: lead.id,
        status: lead.enrichmentStatus,
        alreadyInProgress: true,
      };
    }

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichmentStatus: 'PENDING',
        enrichmentProgress: 0,
        enrichmentError: null,
      },
    });

    let job: Job<LeadEnrichmentJobData>;
    try {
      job = await this.enrichmentQueue.add(
        'enrich',
        { leadId, organizationId, triggeredByUserId: userId },
        { jobId: leadId },
      );
    } catch (error) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          enrichmentStatus: 'FAILED',
          enrichmentError: 'Failed to queue enrichment job',
        },
      });
      throw error;
    }

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { enrichmentJobId: job.id },
    });

    return {
      leadId: lead.id,
      status: 'PENDING' as const,
      alreadyInProgress: false,
    };
  }

  async getEnrichment(organizationId: string, leadId: string) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);

    const [contacts, socialProfiles, website, latestAudit] = await Promise.all([
      this.prisma.leadContact.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leadSocialProfile.findMany({ where: { leadId } }),
      this.prisma.leadWebsite.findUnique({ where: { leadId } }),
      this.prisma.websiteAudit.findFirst({
        where: { leadId },
        orderBy: { auditedAt: 'desc' },
      }),
    ]);

    const signals = buildContactabilitySignals(
      lead,
      contacts,
      socialProfiles,
      website?.metadata ?? null,
    );
    const contactability = calculateContactabilityScore(signals);

    return {
      leadId: lead.id,
      businessName: lead.businessName,
      phone: lead.phone,
      email: lead.email,
      websiteUrl: lead.websiteUrl,
      enrichment: {
        status: lead.enrichmentStatus,
        progress: lead.enrichmentProgress,
        error: lead.enrichmentError,
        lastEnrichedAt: lead.lastEnrichedAt,
      },
      contactability,
      contacts,
      socialProfiles,
      website,
      latestAudit,
    };
  }

  private async getLeadOrThrow(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.organizationId !== organizationId) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }
}

export function buildContactabilitySignals(
  lead: {
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
  },
  contacts: { type: string }[],
  socialProfiles: { platform: string }[],
  websiteMetadata: unknown,
): ContactabilitySignals {
  const metadata = isWebsiteExtraction(websiteMetadata)
    ? websiteMetadata
    : null;

  return {
    hasPhone: !!lead.phone || contacts.some((c) => c.type === 'PHONE'),
    hasEmail: !!lead.email || contacts.some((c) => c.type === 'EMAIL'),
    hasWebsite: !!lead.websiteUrl,
    hasFacebook: socialProfiles.some((s) => s.platform === 'FACEBOOK'),
    hasInstagram: socialProfiles.some((s) => s.platform === 'INSTAGRAM'),
    hasLinkedIn: socialProfiles.some((s) => s.platform === 'LINKEDIN'),
    hasBookingUrl:
      contacts.some((c) => c.type === 'BOOKING_URL') || !!metadata?.bookingUrl,
    hasContactPage: !!metadata?.contactUrl,
    hasContactCta: !!metadata?.hasContactCta,
  };
}

function isWebsiteExtraction(value: unknown): value is WebsiteExtraction {
  return !!value && typeof value === 'object' && 'startUrl' in value;
}
