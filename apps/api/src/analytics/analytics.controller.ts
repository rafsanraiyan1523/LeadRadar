import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgGuard } from '../common/guards/org.guard';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type { ActiveMembership } from '../common/types/express';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFiltersDto } from './dto/analytics-filters.dto';

@UseGuards(OrgGuard)
@ApiTags('Analytics')
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard(@CurrentMembership() membership: ActiveMembership) {
    return this.analytics.getDashboard(membership.organizationId);
  }

  @Get('analytics')
  async getAnalytics(
    @CurrentMembership() membership: ActiveMembership,
    @Query() filters: AnalyticsFiltersDto,
  ) {
    return this.analytics.getAnalytics(membership.organizationId, filters);
  }
}
