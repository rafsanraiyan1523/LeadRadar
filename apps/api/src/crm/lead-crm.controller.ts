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
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { AttachTagDto } from './dto/attach-tag.dto';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { LogLeadActivityDto } from './dto/log-lead-activity.dto';

const WRITE_ROLES = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER] as const;

/** Lead-scoped CRM sub-resources: status, bookmark, notes, tags, follow-ups, activity. */
@UseGuards(OrgGuard)
@ApiTags('CRM')
@Controller('leads')
export class LeadCrmController {
  constructor(private readonly crm: CrmService) {}

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.crm.updateStatus(
      membership.organizationId,
      user.id,
      id,
      dto.status,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post(':id/save')
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.saveLead(membership.organizationId, user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Delete(':id/save')
  async unsave(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.unsaveLead(membership.organizationId, user.id, id);
  }

  @Get(':id/activities')
  async listActivities(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.listActivities(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post(':id/activity')
  async logActivity(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: LogLeadActivityDto,
  ) {
    return this.crm.logActivity(membership.organizationId, user.id, id, dto);
  }

  @Get(':id/notes')
  async listNotes(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.listNotes(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post(':id/notes')
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.crm.addNote(membership.organizationId, user.id, id, dto);
  }

  @Get(':id/tags')
  async listLeadTags(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.listLeadTags(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post(':id/tags')
  async attachTag(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: AttachTagDto,
  ) {
    return this.crm.attachTag(membership.organizationId, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Delete(':id/tags/:tagId')
  async detachTag(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.crm.detachTag(membership.organizationId, id, tagId);
  }

  @Get(':id/follow-ups')
  async listFollowUps(
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
  ) {
    return this.crm.listFollowUps(membership.organizationId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @Post(':id/follow-ups')
  async createFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') id: string,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.crm.createFollowUp(membership.organizationId, user.id, id, dto);
  }
}
