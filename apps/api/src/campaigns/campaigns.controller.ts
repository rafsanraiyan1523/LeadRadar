import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AddCampaignLeadsDto } from './dto/add-campaign-leads.dto';
import { GenerateCampaignMessagesDto } from './dto/generate-campaign-messages.dto';

const WRITE_ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER] as const;

// Bulk message generation calls the AI provider once per campaign lead —
// throttled tightly, same reasoning as AI_GENERATE_THROTTLE in ai.controller.
const CAMPAIGN_GENERATE_THROTTLE = {
  default: { limit: process.env.NODE_ENV === 'test' ? 1000 : 5, ttl: 60_000 },
};

@UseGuards(OrgGuard)
@ApiTags('Campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  async list(@CurrentMembership() membership: ActiveMembership) {
    return this.campaigns.listCampaigns(membership.organizationId);
  }

  @Get(':id')
  async get(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.campaigns.getCampaign(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.campaigns.createCampaign(
      membership.organizationId,
      user.id,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Patch(':id')
  async update(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.updateCampaign(membership.organizationId, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post(':id/leads')
  async addLeads(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: AddCampaignLeadsDto,
  ) {
    return this.campaigns.addLeads(membership.organizationId, id, dto.leadIds);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Delete(':id/leads/:leadId')
  async removeLead(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Param('leadId') leadId: string,
  ) {
    return this.campaigns.removeLead(membership.organizationId, id, leadId);
  }

  @Get(':id/dashboard')
  async getDashboard(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.campaigns.getDashboard(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Throttle(CAMPAIGN_GENERATE_THROTTLE)
  @Post(':id/generate-messages')
  async generateMessages(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: GenerateCampaignMessagesDto,
  ) {
    return this.campaigns.generateMessages(
      membership.organizationId,
      user.id,
      id,
      dto,
    );
  }
}
