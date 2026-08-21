import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createAIProvider,
  mapFindingsToRecommendedServices,
} from '@lead-radar/providers';
import type {
  FollowUpGenerationInput,
  LeadIntelligenceContext,
  OutreachGenerationInput,
} from '@lead-radar/types';
import type { Prisma } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';
import { WebsiteAuditService } from '../digital-intelligence/website-audit.service';
import { ConversionAuditService } from '../digital-intelligence/conversion-audit.service';
import { GoogleBusinessAuditService } from '../digital-intelligence/google-business-audit.service';
import { OpportunityScoringService } from '../digital-intelligence/opportunity-scoring.service';
import { GrowthOpportunityService } from '../digital-intelligence/growth-opportunity.service';
import type { GenerateOutreachDto } from './dto/generate-outreach.dto';
import type { GenerateFollowUpDto } from './dto/generate-follow-up.dto';
import type { UpdateOutreachMessageDto } from './dto/update-outreach-message.dto';

/** Fingerprints the verified inputs an insight was generated from, so a repeat request with unchanged data serves the cache instead of calling the AI provider again (AI COST CONTROL). */
function hashContext(context: LeadIntelligenceContext): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex');
}

/**
 * AiService: the orchestration layer for the five AI features. Every
 * generation is (a) triggered only by an explicit user request — never
 * automatically — and (b) built entirely from LeadIntelligenceContext,
 * which itself is assembled only from the Digital Intelligence Engine's
 * already-verified data (see buildContext). The AIProvider implementations
 * (Mock/Local/External) have no path to any field beyond what's in that
 * context — see the AI RULE in @lead-radar/types/ai.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly websiteAudit: WebsiteAuditService,
    private readonly conversionAudit: ConversionAuditService,
    private readonly googleBusinessAudit: GoogleBusinessAuditService,
    private readonly opportunityScoring: OpportunityScoringService,
    private readonly growthOpportunity: GrowthOpportunityService,
  ) {}

  async getInsight(organizationId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.aIInsight.findUnique({ where: { leadId } });
  }

  /** LEAD SUMMARY + GROWTH OPPORTUNITY ANALYSIS + RECOMMENDED SERVICES, cached per lead — see AI COST CONTROL. */
  async generateInsight(
    organizationId: string,
    userId: string,
    leadId: string,
  ) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);
    const context = await this.buildContext(leadId, lead);
    const inputsHash = hashContext(context);

    const existing = await this.prisma.aIInsight.findUnique({
      where: { leadId },
    });
    if (existing && existing.inputsHash === inputsHash) {
      await this.logUsage(
        organizationId,
        userId,
        leadId,
        'LEAD_SUMMARY',
        existing.providerMode,
        existing.model,
        true,
      );
      await this.logUsage(
        organizationId,
        userId,
        leadId,
        'GROWTH_ANALYSIS',
        existing.providerMode,
        existing.model,
        true,
      );
      return existing;
    }

    const provider = this.getProvider();
    const recommendedServices = mapFindingsToRecommendedServices(
      context.growthOpportunities,
    );

    const [summary, growthAnalysis] = await Promise.all([
      provider.generateLeadSummary(context),
      provider.generateGrowthOpportunityAnalysis(context),
    ]);

    const insight = await this.prisma.aIInsight.upsert({
      where: { leadId },
      create: {
        leadId,
        summary: summary.text,
        growthAnalysis: growthAnalysis.text,
        recommendedServices: recommendedServices.map((s) => s.service),
        providerMode: provider.mode,
        model: summary.model,
        inputsHash,
      },
      update: {
        summary: summary.text,
        growthAnalysis: growthAnalysis.text,
        recommendedServices: recommendedServices.map((s) => s.service),
        providerMode: provider.mode,
        model: summary.model,
        inputsHash,
        generatedAt: new Date(),
      },
    });

    await this.logUsage(
      organizationId,
      userId,
      leadId,
      'LEAD_SUMMARY',
      provider.mode,
      summary.model,
      false,
    );
    await this.logUsage(
      organizationId,
      userId,
      leadId,
      'GROWTH_ANALYSIS',
      provider.mode,
      growthAnalysis.model,
      false,
    );

    return insight;
  }

  async listOutreach(organizationId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.outreachMessage.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * OUTREACH MESSAGE — always a new row (Regenerate creates another, never
   * overwrites — see OUTREACH UX). `campaignId` is only ever passed by
   * CampaignsService's bulk-generation step (never client-supplied — there
   * is no campaignId field on GenerateOutreachDto), so a campaign's
   * "messages generated" count can never be spoofed via the single-lead
   * generation endpoint.
   */
  async generateOutreach(
    organizationId: string,
    userId: string,
    leadId: string,
    dto: GenerateOutreachDto,
    campaignId?: string,
  ) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);
    const context = await this.buildContext(leadId, lead);
    const recommendedServices = mapFindingsToRecommendedServices(
      context.growthOpportunities,
    );
    const provider = this.getProvider();

    const input: OutreachGenerationInput = {
      context,
      recommendedServices,
      channel: dto.channel,
      tone: dto.tone,
      language: dto.language,
    };
    const generated = await provider.generateOutreachMessage(input);

    const message = await this.prisma.outreachMessage.create({
      data: {
        leadId,
        generatedByUserId: userId,
        campaignId,
        kind: 'OUTREACH',
        channel: dto.channel,
        tone: dto.tone,
        language: dto.language,
        subject: generated.subject,
        body: generated.body,
        providerMode: provider.mode,
        model: generated.model,
      },
    });

    await this.logUsage(
      organizationId,
      userId,
      leadId,
      'OUTREACH',
      provider.mode,
      generated.model,
      false,
    );
    await this.logMessageGenerated(organizationId, userId, leadId, message);
    return message;
  }

  /** FOLLOW-UP MESSAGE — references a real, on-file prior message (never client-supplied text) so the AI reasons over verified history only. */
  async generateFollowUp(
    organizationId: string,
    userId: string,
    leadId: string,
    dto: GenerateFollowUpDto,
  ) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);
    const previous = await this.prisma.outreachMessage.findUnique({
      where: { id: dto.previousMessageId },
    });
    if (!previous || previous.leadId !== leadId) {
      throw new NotFoundException('Previous message not found');
    }

    const context = await this.buildContext(leadId, lead);
    const recommendedServices = mapFindingsToRecommendedServices(
      context.growthOpportunities,
    );
    const provider = this.getProvider();

    const input: FollowUpGenerationInput = {
      context,
      recommendedServices,
      channel: dto.channel,
      tone: dto.tone,
      language: dto.language,
      previousMessage: {
        body: previous.body,
        channel: previous.channel,
        sentAt: previous.sentAt?.toISOString() ?? null,
      },
    };
    const generated = await provider.generateFollowUpMessage(input);

    const message = await this.prisma.outreachMessage.create({
      data: {
        leadId,
        generatedByUserId: userId,
        kind: 'FOLLOW_UP',
        channel: dto.channel,
        tone: dto.tone,
        language: dto.language,
        subject: generated.subject,
        body: generated.body,
        providerMode: provider.mode,
        model: generated.model,
      },
    });

    await this.logUsage(
      organizationId,
      userId,
      leadId,
      'FOLLOW_UP',
      provider.mode,
      generated.model,
      false,
    );
    await this.logMessageGenerated(organizationId, userId, leadId, message);
    return message;
  }

  /** EDIT — the user stays in control of the final message text (and can mark it SENT once they've actually sent it via the opened channel). */
  async updateOutreachMessage(
    organizationId: string,
    leadId: string,
    messageId: string,
    dto: UpdateOutreachMessageDto,
  ) {
    await this.getLeadOrThrow(organizationId, leadId);
    const message = await this.prisma.outreachMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.leadId !== leadId) {
      throw new NotFoundException('Outreach message not found');
    }
    if (
      dto.status === 'SENT' &&
      message.channel === 'EMAIL' &&
      dto.subject === undefined &&
      !message.subject
    ) {
      throw new BadRequestException(
        'An email message needs a subject before it can be marked sent',
      );
    }

    return this.prisma.outreachMessage.update({
      where: { id: messageId },
      data: {
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.status !== undefined
          ? {
              status: dto.status,
              sentAt: dto.status === 'SENT' ? new Date() : message.sentAt,
            }
          : {}),
      },
    });
  }

  /** ACTIVITY: "Message generated" — logged next to the OutreachMessage it describes so it can never be spoofed client-side. */
  private async logMessageGenerated(
    organizationId: string,
    userId: string,
    leadId: string,
    message: { id: string; kind: string; channel: string },
  ) {
    await this.prisma.leadActivity.create({
      data: {
        leadId,
        organizationId,
        userId,
        type: 'lead.message_generated',
        metadata: {
          messageId: message.id,
          kind: message.kind,
          channel: message.channel,
        },
      },
    });
  }

  private getProvider() {
    return createAIProvider({
      mode: this.config.get('aiMode', { infer: true }),
      local: {
        baseUrl: this.config.get('ollamaBaseUrl', { infer: true }),
        model: this.config.get('ollamaModel', { infer: true }),
      },
      external: this.config.get('anthropicApiKey', { infer: true })
        ? {
            apiKey: this.config.get('anthropicApiKey', { infer: true }),
            model: this.config.get('anthropicModel', { infer: true }),
          }
        : undefined,
    });
  }

  private async getLeadOrThrow(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.organizationId !== organizationId) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private async buildContext(
    leadId: string,
    lead: {
      businessName: string;
      category: string | null;
      city: string | null;
      country: string | null;
      websiteUrl: string | null;
      phone: string | null;
      email: string | null;
      opportunityScore: number | null;
    },
  ): Promise<LeadIntelligenceContext> {
    const [
      website,
      conversion,
      googleBusiness,
      opportunity,
      growth,
      socialProfiles,
    ] = await Promise.all([
      this.websiteAudit.getForLead(leadId),
      this.conversionAudit.getForLead(leadId),
      this.googleBusinessAudit.getForLead(leadId),
      this.opportunityScoring.getForLead(leadId),
      this.growthOpportunity.getForLead(leadId),
      this.prisma.leadSocialProfile.findMany({ where: { leadId } }),
    ]);

    const location =
      [lead.city, lead.country].filter(Boolean).join(', ') || null;

    return {
      businessName: lead.businessName,
      category: lead.category,
      location,
      opportunityScore: opportunity?.score ?? lead.opportunityScore ?? null,
      opportunityLevel: opportunity?.level ?? null,
      website: {
        exists: !!lead.websiteUrl,
        url: lead.websiteUrl,
        score: website?.websiteScore ?? null,
        hasSsl: website?.hasSsl ?? null,
        hasBookingUrl: conversion.breakdown?.hasBookingCta ?? false,
        hasContactCta: conversion.breakdown?.hasContactCta ?? false,
      },
      seoScore: website?.seoScore ?? null,
      conversionScore: conversion.score,
      googleBusiness: {
        status: googleBusiness.status,
        rating: googleBusiness.signals?.rating ?? null,
        reviewCount: googleBusiness.signals?.userRatingCount ?? null,
      },
      contactability: {
        score: conversion.contactability.score,
        hasPhone: conversion.contactability.breakdown.hasPhone,
        hasEmail: conversion.contactability.breakdown.hasEmail,
        hasFacebook: conversion.contactability.breakdown.hasFacebook,
        hasInstagram: conversion.contactability.breakdown.hasInstagram,
        hasLinkedIn: conversion.contactability.breakdown.hasLinkedIn,
      },
      contactChannels: {
        phone: lead.phone,
        email: lead.email,
        website: lead.websiteUrl,
        facebookUrl:
          socialProfiles.find((s) => s.platform === 'FACEBOOK')?.url ?? null,
        linkedinUrl:
          socialProfiles.find((s) => s.platform === 'LINKEDIN')?.url ?? null,
      },
      growthOpportunities: growth.map((g) => ({
        title: g.title,
        category: g.category,
        severity: g.severity,
        evidence: g.evidence,
        recommendation: g.recommendation,
      })),
    };
  }

  private async logUsage(
    organizationId: string,
    userId: string,
    leadId: string,
    feature: Prisma.AIUsageEventUncheckedCreateInput['feature'],
    providerMode: Prisma.AIUsageEventUncheckedCreateInput['providerMode'],
    model: string,
    cached: boolean,
  ) {
    await this.prisma.aIUsageEvent.create({
      data: {
        organizationId,
        userId,
        leadId,
        feature,
        providerMode,
        model,
        cached,
      },
    });
  }
}
