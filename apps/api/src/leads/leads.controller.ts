import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OrgGuard } from '../common/guards/org.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type {
  ActiveMembership,
  AuthenticatedUser,
} from '../common/types/express';
import { LeadsService } from './leads.service';

// Enrichment does real outbound HTTP work per call — throttled more tightly
// than the app's general default, mirroring /searches.
const ENRICH_THROTTLE = {
  default: { limit: process.env.NODE_ENV === 'test' ? 1000 : 20, ttl: 60_000 },
};

@UseGuards(OrgGuard)
@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Throttle(ENRICH_THROTTLE)
  @Post(':id/enrich')
  async enrich(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.leads.enrichLead(membership.organizationId, user.id, id);
  }

  @Get(':id/enrichment')
  async getEnrichment(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.leads.getEnrichment(membership.organizationId, id);
  }
}
