import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { OrgRole } from '@lead-radar/db';
import { OrgGuard } from '../common/guards/org.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type {
  ActiveMembership,
  AuthenticatedUser,
} from '../common/types/express';
import { CrmService } from './crm.service';
import { ListLeadsDto } from './dto/list-leads.dto';

const WRITE_ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER] as const;

/** Top-level CRM resources — lead-scoped sub-resources live on LeadCrmController (@Controller('leads')). */
@UseGuards(OrgGuard)
@ApiTags('CRM')
@Controller()
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('pipeline')
  async getPipeline(@CurrentMembership() membership: ActiveMembership) {
    return this.crm.getPipeline(membership.organizationId);
  }

  @Get('leads')
  async listLeads(
    @CurrentMembership() membership: ActiveMembership,
    @Query() dto: ListLeadsDto,
  ) {
    return this.crm.listLeads(membership.organizationId, dto);
  }

  @Get('leads/export')
  async exportLeads(
    @CurrentMembership() membership: ActiveMembership,
    @Query() dto: ListLeadsDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.crm.exportLeadsCsv(membership.organizationId, dto);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    });
    return csv;
  }

  @Get('saved-leads')
  async listSaved(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListLeadsDto,
  ) {
    return this.crm.listSaved(membership.organizationId, user.id, dto);
  }

  @Get('tags')
  async listTags(@CurrentMembership() membership: ActiveMembership) {
    return this.crm.listTags(membership.organizationId);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Patch('follow-ups/:id/complete')
  async completeFollowUp(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.completeFollowUp(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Patch('follow-ups/:id/cancel')
  async cancelFollowUp(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.cancelFollowUp(membership.organizationId, id);
  }
}
