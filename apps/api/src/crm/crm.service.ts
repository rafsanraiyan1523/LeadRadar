import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { calculateContactabilityScore } from '@lead-radar/providers';
import type { FollowUpReminderJobData } from '@lead-radar/types';
import type { LeadStatus, Prisma } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import { FOLLOW_UP_REMINDER_QUEUE_TOKEN } from '../queue/queue.module';
import { buildContactabilitySignals } from '../leads/leads.service';
import { toCsv, type CsvColumn } from '../common/lib/csv';
import type { ListLeadsDto } from './dto/list-leads.dto';
import type { CreateFollowUpDto } from './dto/create-follow-up.dto';
import type { AddNoteDto } from './dto/add-note.dto';
import type { AttachTagDto } from './dto/attach-tag.dto';
import type { LogLeadActivityDto } from './dto/log-lead-activity.dto';
import type { LeadCardView, PaginatedLeadCards, WebsiteState } from './types';

/**
 * A soft cap on the pipeline board — it renders every matching lead at once
 * (no pagination in the Kanban UI), so this bounds the query rather than
 * exposing a page size the board doesn't use.
 */
const PIPELINE_MAX_LEADS = 500;

const LEAD_CARD_INCLUDE = {
  contacts: true,
  socialProfiles: true,
  website: { select: { metadata: true } },
  websiteAudits: { orderBy: { auditedAt: 'desc' as const }, take: 1 },
  googleBusinessProfile: { select: { status: true } },
  tags: { include: { tag: true } },
  activities: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  followUps: {
    where: { status: 'PENDING' as const },
    orderBy: { dueAt: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.LeadInclude;

type LeadWithCardRelations = Prisma.LeadGetPayload<{
  include: typeof LEAD_CARD_INCLUDE;
}>;

/**
 * The exported column list — an explicit allow-list of application-owned
 * fields. `rating`/`reviewCount` (Google's star rating and review count)
 * are deliberately never included here even though they're present on
 * LeadCardView for in-app display — see exportLeadsCsv.
 */
const LEAD_EXPORT_COLUMNS: CsvColumn<LeadCardView>[] = [
  { header: 'Business Name', value: (l) => l.businessName },
  { header: 'Category', value: (l) => l.category },
  { header: 'Address', value: (l) => l.address },
  { header: 'City', value: (l) => l.city },
  { header: 'Country', value: (l) => l.country },
  { header: 'Status', value: (l) => l.leadStatus },
  { header: 'Opportunity Score', value: (l) => l.opportunityScore },
  { header: 'Contactability Score', value: (l) => l.contactabilityScore },
  { header: 'Website State', value: (l) => l.websiteState },
  { header: 'Website URL', value: (l) => l.websiteUrl },
  { header: 'Tags', value: (l) => l.tags.map((t) => t.name).join('; ') },
  { header: 'Created At', value: (l) => l.createdAt },
];

export function deriveWebsiteState(
  websiteUrl: string | null,
  websiteScore: number | null,
): WebsiteState {
  if (!websiteUrl) return 'NO_WEBSITE';
  if (websiteScore === null) return 'UNAUDITED';
  if (websiteScore >= 66) return 'STRONG';
  if (websiteScore >= 33) return 'AVERAGE';
  return 'WEAK';
}

function toLeadCard(lead: LeadWithCardRelations): LeadCardView {
  const latestAudit = lead.websiteAudits[0];
  const contactability = calculateContactabilityScore(
    buildContactabilitySignals(
      lead,
      lead.contacts,
      lead.socialProfiles,
      lead.website?.metadata ?? null,
    ),
  );
  const lastActivity = lead.activities[0];
  const nextFollowUp = lead.followUps[0];

  return {
    id: lead.id,
    businessName: lead.businessName,
    category: lead.category,
    address: lead.address,
    city: lead.city,
    country: lead.country,
    leadStatus: lead.leadStatus,
    opportunityScore: lead.opportunityScore,
    contactabilityScore: contactability.score,
    websiteState: deriveWebsiteState(
      lead.websiteUrl,
      latestAudit?.websiteScore ?? null,
    ),
    websiteUrl: lead.websiteUrl,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    googleProfileStatus: lead.googleBusinessProfile?.status ?? 'UNVERIFIED',
    tags: lead.tags.map((lt) => ({
      id: lt.tag.id,
      name: lt.tag.name,
      color: lt.tag.color,
    })),
    lastActivity: lastActivity
      ? {
          type: lastActivity.type,
          createdAt: lastActivity.createdAt.toISOString(),
        }
      : null,
    nextFollowUp: nextFollowUp
      ? {
          id: nextFollowUp.id,
          dueAt: nextFollowUp.dueAt.toISOString(),
          note: nextFollowUp.note,
        }
      : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FOLLOW_UP_REMINDER_QUEUE_TOKEN)
    private readonly followUpQueue: Queue<FollowUpReminderJobData>,
  ) {}

  /** Every lead in the org, for the Kanban board — the client groups by leadStatus into columns. */
  async getPipeline(
    organizationId: string,
  ): Promise<{ items: LeadCardView[] }> {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId },
      include: LEAD_CARD_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: PIPELINE_MAX_LEADS,
    });
    return { items: leads.map(toLeadCard) };
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    leadId: string,
    status: LeadStatus,
  ) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);
    if (lead.leadStatus === status) {
      return lead;
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { leadStatus: status },
    });

    await this.prisma.leadActivity.create({
      data: {
        leadId,
        organizationId,
        userId,
        type: 'lead.status_changed',
        metadata: { from: lead.leadStatus, to: status },
      },
    });

    return updated;
  }

  async listLeads(
    organizationId: string,
    dto: ListLeadsDto,
  ): Promise<PaginatedLeadCards> {
    const where = this.buildWhere(organizationId, dto);
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: LEAD_CARD_INCLUDE,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { items: items.map(toLeadCard), total, page, pageSize };
  }

  /**
   * EXPORT — application-owned lead data only. Deliberately excludes every
   * Google-Places-sourced field (rating, reviewCount, googlePlaceId,
   * googleMapsUri, businessStatus, and the whole GoogleBusinessProfile
   * record) — that data is Google's, cached under Google's own terms for
   * in-app display, not ours to redistribute in a bulk export. What's
   * exported is either user/LeadRadar-owned (status, tags, scores) or
   * ordinary business-directory contact info entered/crawled directly
   * (name, address, phone, email, website).
   */
  async exportLeadsCsv(
    organizationId: string,
    dto: ListLeadsDto,
  ): Promise<string> {
    const where = this.buildWhere(organizationId, dto);
    const leads = await this.prisma.lead.findMany({
      where,
      include: LEAD_CARD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return toCsv(leads.map(toLeadCard), LEAD_EXPORT_COLUMNS);
  }

  async listSaved(
    organizationId: string,
    userId: string,
    dto: ListLeadsDto,
  ): Promise<PaginatedLeadCards> {
    const leadWhere = this.buildWhere(organizationId, dto);
    const where: Prisma.SavedLeadWhereInput = {
      organizationId,
      userId,
      lead: leadWhere,
    };
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;

    const [rows, total] = await Promise.all([
      this.prisma.savedLead.findMany({
        where,
        include: { lead: { include: LEAD_CARD_INCLUDE } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.savedLead.count({ where }),
    ]);

    return {
      items: rows.map((r) => toLeadCard(r.lead)),
      total,
      page,
      pageSize,
    };
  }

  async saveLead(organizationId: string, userId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    await this.prisma.savedLead.upsert({
      where: { leadId_userId: { leadId, userId } },
      create: { leadId, userId, organizationId },
      update: {},
    });
    return { saved: true };
  }

  async unsaveLead(organizationId: string, userId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    await this.prisma.savedLead.deleteMany({ where: { leadId, userId } });
    return { saved: false };
  }

  async listActivities(organizationId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Private CRM notes are just a LeadActivity kind — one timeline, one write path, matching the ACTIVITY "Note added" requirement. */
  async addNote(
    organizationId: string,
    userId: string,
    leadId: string,
    dto: AddNoteDto,
  ) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.leadActivity.create({
      data: {
        leadId,
        organizationId,
        userId,
        type: 'lead.note_added',
        metadata: { text: dto.text },
      },
    });
  }

  async listNotes(organizationId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.leadActivity.findMany({
      where: { leadId, type: 'lead.note_added' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async listTags(organizationId: string) {
    return this.prisma.tag.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async listLeadTags(organizationId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    const rows = await this.prisma.leadTag.findMany({
      where: { leadId },
      include: { tag: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.tag);
  }

  /** Finds-or-creates the org's tag by name, then attaches it — lets the UI offer preset chips and free-text tags through one call. */
  async attachTag(organizationId: string, leadId: string, dto: AttachTagDto) {
    await this.getLeadOrThrow(organizationId, leadId);
    const name = dto.name.trim();

    const tag = await this.prisma.tag.upsert({
      where: { organizationId_name: { organizationId, name } },
      create: { organizationId, name, color: dto.color },
      update: dto.color ? { color: dto.color } : {},
    });

    await this.prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId: tag.id } },
      create: { leadId, tagId: tag.id },
      update: {},
    });

    return tag;
  }

  async detachTag(organizationId: string, leadId: string, tagId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    await this.prisma.leadTag.deleteMany({ where: { leadId, tagId } });
    return { ok: true };
  }

  async createFollowUp(
    organizationId: string,
    userId: string,
    leadId: string,
    dto: CreateFollowUpDto,
  ) {
    const lead = await this.getLeadOrThrow(organizationId, leadId);
    const dueAt = new Date(dto.dueAt);

    const followUp = await this.prisma.followUp.create({
      data: { leadId, organizationId, userId, dueAt, note: dto.note },
    });

    await this.prisma.leadActivity.create({
      data: {
        leadId,
        organizationId,
        userId,
        type: 'lead.follow_up_created',
        metadata: { dueAt: dueAt.toISOString(), note: dto.note ?? null },
      },
    });

    await this.prisma.notification.create({
      data: {
        organizationId,
        userId,
        type: 'follow_up.created',
        title: `Follow-up scheduled for ${lead.businessName}`,
        body: dto.note ?? `Due ${dueAt.toLocaleDateString()}`,
        metadata: {
          leadId,
          followUpId: followUp.id,
          dueAt: dueAt.toISOString(),
        },
      },
    });

    const delay = Math.max(0, dueAt.getTime() - Date.now());
    await this.followUpQueue.add(
      'remind',
      { followUpId: followUp.id, organizationId, userId, leadId },
      { delay, jobId: followUp.id },
    );

    return followUp;
  }

  async listFollowUps(organizationId: string, leadId: string) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.followUp.findMany({
      where: { leadId },
      orderBy: { dueAt: 'asc' },
    });
  }

  async completeFollowUp(organizationId: string, followUpId: string) {
    const followUp = await this.getFollowUpOrThrow(organizationId, followUpId);
    await this.followUpQueue.remove(followUp.id);
    return this.prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: 'DONE', completedAt: new Date() },
    });
  }

  async cancelFollowUp(organizationId: string, followUpId: string) {
    const followUp = await this.getFollowUpOrThrow(organizationId, followUpId);
    await this.followUpQueue.remove(followUp.id);
    return this.prisma.followUp.update({
      where: { id: followUp.id },
      data: { status: 'CANCELLED' },
    });
  }

  async logActivity(
    organizationId: string,
    userId: string,
    leadId: string,
    dto: LogLeadActivityDto,
  ) {
    await this.getLeadOrThrow(organizationId, leadId);
    return this.prisma.leadActivity.create({
      data: {
        leadId,
        organizationId,
        userId,
        type: dto.type,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private buildWhere(
    organizationId: string,
    dto: ListLeadsDto,
  ): Prisma.LeadWhereInput {
    const where: Prisma.LeadWhereInput = { organizationId };

    if (dto.status) {
      where.leadStatus = dto.status;
    }
    if (dto.category) {
      where.category = { contains: dto.category, mode: 'insensitive' };
    }
    if (dto.location) {
      where.OR = [
        { city: { contains: dto.location, mode: 'insensitive' } },
        { address: { contains: dto.location, mode: 'insensitive' } },
      ];
    }
    if (dto.minScore !== undefined || dto.maxScore !== undefined) {
      where.opportunityScore = {
        ...(dto.minScore !== undefined ? { gte: dto.minScore } : {}),
        ...(dto.maxScore !== undefined ? { lte: dto.maxScore } : {}),
      };
    }
    if (dto.website === 'HAS_WEBSITE') {
      where.websiteUrl = { not: null };
    } else if (dto.website === 'NO_WEBSITE') {
      where.websiteUrl = null;
    }
    if (dto.googleProfile && dto.googleProfile !== 'ANY') {
      where.googleBusinessProfile = { status: dto.googleProfile };
    }
    if (dto.search) {
      where.businessName = { contains: dto.search, mode: 'insensitive' };
    }
    if (dto.minContactability !== undefined) {
      where.websiteAudits = {
        some: { contactabilityScore: { gte: dto.minContactability } },
      };
    }

    return where;
  }

  private async getLeadOrThrow(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.organizationId !== organizationId) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private async getFollowUpOrThrow(organizationId: string, followUpId: string) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id: followUpId },
    });
    if (!followUp || followUp.organizationId !== organizationId) {
      throw new NotFoundException('Follow-up not found');
    }
    return followUp;
  }
}
