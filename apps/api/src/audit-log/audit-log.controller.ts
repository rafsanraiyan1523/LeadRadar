import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrgRole } from '@lead-radar/db';
import { OrgGuard } from '../common/guards/org.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import type { ActiveMembership } from '../common/types/express';
import { AuditLogService } from './audit-log.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

/** Audit history is sensitive (who logged in when, from where, role changes) — OWNER/ADMIN only. */
@UseGuards(OrgGuard, RolesGuard)
@Roles(OrgRole.OWNER, OrgRole.ADMIN)
@ApiTags('Audit Log')
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  async list(
    @CurrentMembership() membership: ActiveMembership,
    @Query() dto: ListAuditLogsDto,
  ) {
    return this.auditLog.list(membership.organizationId, dto);
  }
}
