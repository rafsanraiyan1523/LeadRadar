import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgGuard } from '../common/guards/org.guard';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type { ActiveMembership } from '../common/types/express';
import { PrismaService } from '../prisma/prisma.service';
import { WebsiteAuditService } from './website-audit.service';
import { SeoAuditService } from './seo-audit.service';
import { ConversionAuditService } from './conversion-audit.service';
import { GoogleBusinessAuditService } from './google-business-audit.service';
import { OpportunityScoringService } from './opportunity-scoring.service';
import { GrowthOpportunityService } from './growth-opportunity.service';

/**
 * The Digital Intelligence Engine's read API for the lead audit page
 * (/app/leads/:id). Aggregates all six audit services into one response so
 * the page loads with a single fetch — each service still owns its own
 * slice of the read logic, matching the worker's write-side pipeline
 * (WebsiteAuditService / SEOAuditService / ConversionAuditService /
 * GoogleBusinessAuditService / OpportunityScoringService /
 * GrowthOpportunityService).
 */
@UseGuards(OrgGuard)
@ApiTags('Audit')
@Controller('leads')
export class DigitalIntelligenceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteAudit: WebsiteAuditService,
    private readonly seoAudit: SeoAuditService,
    private readonly conversionAudit: ConversionAuditService,
    private readonly googleBusinessAudit: GoogleBusinessAuditService,
    private readonly opportunityScoring: OpportunityScoringService,
    private readonly growthOpportunities: GrowthOpportunityService,
  ) {}

  @Get(':id/audit')
  async getAudit(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead || lead.organizationId !== membership.organizationId) {
      throw new NotFoundException('Lead not found');
    }

    const [
      website,
      seo,
      conversion,
      googleBusiness,
      opportunity,
      growth,
      socialProfiles,
      contacts,
      activity,
    ] = await Promise.all([
      this.websiteAudit.getForLead(id),
      this.seoAudit.getForLead(id),
      this.conversionAudit.getForLead(id),
      this.googleBusinessAudit.getForLead(id),
      this.opportunityScoring.getForLead(id),
      this.growthOpportunities.getForLead(id),
      this.prisma.leadSocialProfile.findMany({ where: { leadId: id } }),
      this.prisma.leadContact.findMany({
        where: { leadId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leadActivity.findMany({
        where: { leadId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      lead: {
        id: lead.id,
        businessName: lead.businessName,
        category: lead.category,
        address: lead.address,
        city: lead.city,
        country: lead.country,
        phone: lead.phone,
        email: lead.email,
        websiteUrl: lead.websiteUrl,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        businessStatus: lead.businessStatus,
        leadStatus: lead.leadStatus,
        createdAt: lead.createdAt.toISOString(),
        lastEnrichedAt: lead.lastEnrichedAt?.toISOString() ?? null,
        enrichmentStatus: lead.enrichmentStatus,
        enrichmentProgress: lead.enrichmentProgress,
        enrichmentError: lead.enrichmentError,
      },
      opportunity,
      website,
      seo,
      conversion,
      googleBusiness,
      growthOpportunities: growth,
      social: socialProfiles,
      contacts,
      activity,
    };
  }
}
