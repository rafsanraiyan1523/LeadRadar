import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgGuard } from '../common/guards/org.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type {
  ActiveMembership,
  AuthenticatedUser,
} from '../common/types/express';
import { NotificationsService } from './notifications.service';

@UseGuards(OrgGuard)
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.list(membership.organizationId, user.id);
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('read-all')
  async markAllRead(
    @CurrentMembership() membership: ActiveMembership,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.notifications.markAllRead(membership.organizationId, user.id);
    return { ok: true };
  }
}
