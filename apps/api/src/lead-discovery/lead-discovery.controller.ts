import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrgGuard } from '../common/guards/org.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type {
  ActiveMembership,
  AuthenticatedUser,
} from '../common/types/express';
import { LeadDiscoveryService } from './lead-discovery.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { ListSearchResultsDto } from './dto/list-search-results.dto';
import { ListSearchesDto } from './dto/list-searches.dto';
import { BulkSaveDto } from './dto/bulk-save.dto';

// Search creation kicks off real provider work (and, in GOOGLE mode, billed
// calls) — throttled more tightly than the app's general 100/min default.
const SEARCH_THROTTLE = {
  default: { limit: process.env.NODE_ENV === 'test' ? 1000 : 20, ttl: 60_000 },
};

@UseGuards(OrgGuard)
@ApiTags('Search')
@Controller()
export class LeadDiscoveryController {
  constructor(private readonly leadDiscovery: LeadDiscoveryService) {}

  @Throttle(SEARCH_THROTTLE)
  @Post('searches')
  async createSearch(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Body() dto: CreateSearchDto,
  ) {
    return this.leadDiscovery.createSearch(
      membership.organizationId,
      user.id,
      dto,
    );
  }

  @Get('searches')
  async listSearches(
    @CurrentMembership() membership: ActiveMembership,
    @Query() dto: ListSearchesDto,
  ) {
    return this.leadDiscovery.listSearches(membership.organizationId, dto);
  }

  @Get('searches/:id')
  async getSearch(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.leadDiscovery.getSearch(membership.organizationId, id);
  }

  @Get('searches/:id/results')
  async listResults(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Query() dto: ListSearchResultsDto,
  ) {
    return this.leadDiscovery.listResults(membership.organizationId, id, dto);
  }

  @Post('search-results/bulk-save')
  async bulkSave(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Body() dto: BulkSaveDto,
  ) {
    return this.leadDiscovery.bulkSave(
      membership.organizationId,
      user.id,
      dto.searchResultIds,
    );
  }
}
