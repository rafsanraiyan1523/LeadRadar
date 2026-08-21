import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bullmq';
import type { LeadDiscoveryJobData } from '@lead-radar/types';
import type { Search } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';
import { LEAD_DISCOVERY_QUEUE_TOKEN } from '../queue/queue.module';
import type { CreateSearchDto } from './dto/create-search.dto';
import type { ListSearchResultsDto } from './dto/list-search-results.dto';
import type { ListSearchesDto } from './dto/list-searches.dto';

@Injectable()
export class LeadDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(LEAD_DISCOVERY_QUEUE_TOKEN)
    private readonly queue: Queue<LeadDiscoveryJobData>,
  ) {}

  async createSearch(
    organizationId: string,
    userId: string,
    dto: CreateSearchDto,
  ): Promise<Search> {
    const maxResults = Math.min(
      dto.maxResults ?? this.config.get('maxResultsPerSearch', { infer: true }),
      this.config.get('maxResultsPerSearch', { infer: true }),
    );

    const configuredMode = this.config.get('leadDiscoveryProviderMode', {
      infer: true,
    });
    const providerMode =
      dto.useLiveProvider && configuredMode === 'GOOGLE' ? 'GOOGLE' : 'MOCK';

    const search = await this.prisma.search.create({
      data: {
        organizationId,
        userId,
        query: dto.query.trim(),
        location: dto.location.trim(),
        filters: dto.filters ? (dto.filters as object) : undefined,
        providerMode,
        status: 'PENDING',
      },
    });

    let job: Job<LeadDiscoveryJobData>;
    try {
      job = await this.queue.add(
        'search',
        {
          searchId: search.id,
          organizationId,
          query: search.query,
          location: search.location ?? '',
          radiusMeters: dto.radiusMeters,
          maxResults,
          providerMode,
        },
        { jobId: search.id },
      );
    } catch (error) {
      // Enqueue failed (e.g. Redis unreachable) — don't leave an orphaned
      // "PENDING" search with no job behind it that will never progress.
      await this.prisma.search.update({
        where: { id: search.id },
        data: { status: 'FAILED', errorMessage: 'Failed to queue search job' },
      });
      throw error;
    }

    return this.prisma.search.update({
      where: { id: search.id },
      data: { jobId: job.id },
    });
  }

  async getSearch(organizationId: string, searchId: string): Promise<Search> {
    const search = await this.prisma.search.findUnique({
      where: { id: searchId },
    });
    if (!search || search.organizationId !== organizationId) {
      throw new NotFoundException('Search not found');
    }
    return search;
  }

  async listSearches(organizationId: string, dto: ListSearchesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const [items, total] = await Promise.all([
      this.prisma.search.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.search.count({ where: { organizationId } }),
    ]);

    return { items, total, page, pageSize };
  }

  async listResults(
    organizationId: string,
    searchId: string,
    dto: ListSearchResultsDto,
  ) {
    const search = await this.getSearch(organizationId, searchId);

    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const sortBy = dto.sortBy ?? 'rating';
    const order = dto.order ?? 'desc';

    const where = {
      searchId: search.id,
      ...(dto.minRating !== undefined
        ? { rating: { gte: dto.minRating } }
        : {}),
      ...(dto.hasWebsite !== undefined
        ? { hasWebsite: dto.hasWebsite === 'true' }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.searchResult.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.searchResult.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async bulkSave(
    organizationId: string,
    userId: string,
    searchResultIds: string[],
  ) {
    const results = await this.prisma.searchResult.findMany({
      where: { id: { in: searchResultIds }, search: { organizationId } },
    });

    if (results.length === 0) {
      throw new BadRequestException(
        'None of the given search results were found',
      );
    }

    const createdLeadIds: string[] = [];

    for (const result of results) {
      if (result.promotedToLeadId) {
        createdLeadIds.push(result.promotedToLeadId);
        continue;
      }

      const lead = await this.prisma.$transaction(async (tx) => {
        const created = await tx.lead.create({
          data: {
            organizationId,
            createdByUserId: userId,
            businessName: result.businessName,
            category: result.category,
            address: result.address,
            city: result.city,
            country: result.country,
            latitude: result.latitude,
            longitude: result.longitude,
            googlePlaceId: result.externalId?.startsWith('mock:')
              ? null
              : result.externalId,
            googleMapsUri: result.googleMapsUri,
            rating: result.rating,
            reviewCount: result.reviewCount,
            businessStatus: result.businessStatus,
            websiteUrl: result.websiteUrl,
            phone: result.phone,
            opportunityScore: result.opportunityScore,
            leadStatus: 'SAVED',
          },
        });

        await tx.searchResult.update({
          where: { id: result.id },
          data: { promotedToLeadId: created.id },
        });

        await tx.leadActivity.create({
          data: {
            leadId: created.id,
            organizationId,
            userId,
            type: 'lead.saved_from_search',
            metadata: { searchId: result.searchId },
          },
        });

        return created;
      });

      createdLeadIds.push(lead.id);
    }

    return { leadIds: createdLeadIds };
  }
}
