import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
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
  AuthenticatedUser,
  ActiveMembership,
} from '../common/types/express';
import { OrganizationsService } from './organizations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizations.listForUser(user.id);
  }

  @Post('invitations/accept')
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
    @Ip() ip: string,
  ) {
    return this.organizations.acceptInvitation(
      user.id,
      user.email,
      dto.token,
      ip,
    );
  }

  @UseGuards(OrgGuard)
  @Get('members')
  async listMembers(@CurrentMembership() membership: ActiveMembership) {
    return this.organizations.listMembers(membership.organizationId);
  }

  @UseGuards(OrgGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @Post('invitations')
  async createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Body() dto: CreateInvitationDto,
    @Ip() ip: string,
  ) {
    return this.organizations.createInvitation(
      membership.organizationId,
      user.id,
      membership.role,
      dto,
      ip,
    );
  }

  @UseGuards(OrgGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @Patch('members/:id/role')
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Ip() ip: string,
  ) {
    return this.organizations.updateMemberRole(
      membership.organizationId,
      memberId,
      dto.role,
      membership.role,
      user.id,
      ip,
    );
  }

  @UseGuards(OrgGuard, RolesGuard)
  @Roles(OrgRole.OWNER, OrgRole.ADMIN)
  @Delete('members/:id')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: ActiveMembership,
    @Param('id') memberId: string,
    @Ip() ip: string,
  ) {
    await this.organizations.removeMember(
      membership.organizationId,
      memberId,
      membership.role,
      user.id,
      ip,
    );
    return { ok: true };
  }
}
