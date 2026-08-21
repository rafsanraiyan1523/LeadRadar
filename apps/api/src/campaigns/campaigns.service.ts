import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';
import type { GenerateCampaignMessagesDto } from './dto/generate-campaign-messages.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async createCampaign(
    organizationId: string,
    userId: string,
    dto: CreateCampaignDto,
  ) {
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: dto.leadIds }, organizationId },
      select: { id: true },
    });

    return this.prisma.campaign.create({
      data: {
        organizationId,
        createdByUserId: userId,
        name: dto.name,
        description: dto.description,
        targetCategory: dto.targetCategory,
        targetLocation: dto.targetLocation,
        service: dto.service,
        tone: dto.tone,
        channel: dto.channel,
        leads: {
          create: leads.map((lead) => ({ leadId: lead.id })),
        },
      },
      include: { _count: { select: { leads: true } } },
    });
  }

  async listCampaigns(organizationId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true, outreachMessages: true } } },
    });
    return campaigns.map((c) => ({
      ...c,
      leadCount: c._count.leads,
      messageCount: c._count.outreachMessages,
    }));
  }

  async getCampaign(organizationId: string, campaignId: string) {
    const campaign = await this.getCampaignOrThrow(organizationId, campaignId);
    const leads = await this.prisma.campaignLead.findMany({
      where: { campaignId },
      orderBy: { addedAt: 'desc' },
      include: {
        lead: {
          select: {
            id: true,
            businessName: true,
            category: true,
            city: true,
            opportunityScore: true,
            leadStatus: true,
            websiteUrl: true,
          },
        },
      },
    });

    return {
      ...campaign,
      leads: leads.map((cl) => ({ ...cl.lead, campaignLeadStatus: cl.status })),
    };
  }

  async updateCampaign(
    organizationId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ) {
    await this.getCampaignOrThrow(organizationId, campaignId);
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: dto,
    });
  }

  async addLeads(
    organizationId: string,
    campaignId: string,
    leadIds: string[],
  ) {
    await this.getCampaignOrThrow(organizationId, campaignId);
    const leads = await this.prisma.lead.findMany({
      where: { id: { in: leadIds }, organizationId },
      select: { id: true },
    });

    await this.prisma.$transaction(
      leads.map((lead) =>
        this.prisma.campaignLead.upsert({
          where: { campaignId_leadId: { campaignId, leadId: lead.id } },
          create: { campaignId, leadId: lead.id },
          update: {},
        }),
      ),
    );

    return this.getCampaign(organizationId, campaignId);
  }

  async removeLead(organizationId: string, campaignId: string, leadId: string) {
    await this.getCampaignOrThrow(organizationId, campaignId);
    await this.prisma.campaignLead.deleteMany({
      where: { campaignId, leadId },
    });
    return { ok: true };
  }

  /** CAMPAIGN DASHBOARD — all figures computed live from the campaign's current leads/messages, never hardcoded. */
  async getDashboard(organizationId: string, campaignId: string) {
    await this.getCampaignOrThrow(organizationId, campaignId);

    const [leadStatusCounts, messageCount, totalLeads] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['leadStatus'],
        where: { campaignLeads: { some: { campaignId } } },
        _count: true,
      }),
      this.prisma.outreachMessage.count({ where: { campaignId } }),
      this.prisma.campaignLead.count({ where: { campaignId } }),
    ]);

    const countFor = (status: string) =>
      leadStatusCounts.find((c) => c.leadStatus === status)?._count ?? 0;

    const contacted = countFor('CONTACTED');
    const replied = countFor('REPLIED');
    const meetings = countFor('MEETING');
    const won = countFor('WON');

    return {
      leads: totalLeads,
      messagesGenerated: messageCount,
      contacted,
      replied,
      meetings,
      won,
      conversionRate: totalLeads > 0 ? won / totalLeads : 0,
    };
  }

  /**
   * Bulk-generates a DRAFT outreach message (never SENT — see "Do not
   * automatically send messages") for every campaign lead that doesn't
   * already have one from this campaign, using the campaign's own
   * service/tone/channel. Sequential (not Promise.all) so it never bursts
   * the configured AI provider with concurrent requests.
   */
  async generateMessages(
    organizationId: string,
    userId: string,
    campaignId: string,
    dto: GenerateCampaignMessagesDto,
  ) {
    const campaign = await this.getCampaignOrThrow(organizationId, campaignId);
    const language = dto.language ?? 'ENGLISH';

    const campaignLeads = await this.prisma.campaignLead.findMany({
      where: { campaignId },
      select: { leadId: true },
    });
    const alreadyGenerated = await this.prisma.outreachMessage.findMany({
      where: { campaignId },
      select: { leadId: true },
    });
    const alreadyGeneratedLeadIds = new Set(
      alreadyGenerated.map((m) => m.leadId),
    );

    const pending = campaignLeads.filter(
      (cl) => !alreadyGeneratedLeadIds.has(cl.leadId),
    );

    let generated = 0;
    let failed = 0;
    for (const { leadId } of pending) {
      try {
        await this.ai.generateOutreach(
          organizationId,
          userId,
          leadId,
          { channel: campaign.channel, tone: campaign.tone, language },
          campaignId,
        );
        generated++;
      } catch {
        // One lead's generation failing (e.g. a since-deleted lead) shouldn't
        // abort the whole batch — the campaign dashboard's message count
        // just reflects what actually succeeded.
        failed++;
      }
    }

    return {
      generated,
      failed,
      alreadyGenerated: alreadyGeneratedLeadIds.size,
    };
  }

  private async getCampaignOrThrow(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign || campaign.organizationId !== organizationId) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }
}
