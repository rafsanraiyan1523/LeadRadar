import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import type { ListAuditLogsDto } from './dto/list-audit-logs.dto';

/**
 * An open string catalog (like LeadActivity.type) rather than a Prisma enum
 * — new audit-worthy actions get added here as call sites need them, never
 * a migration. Every entry here is a genuinely security/permission-relevant
 * event (auth, membership, roles) — not general CRUD, which already has
 * its own trail via LeadActivity.
 */
export const AUDIT_ACTIONS = [
  'user.registered',
  'user.login',
  'user.logout',
  'user.password_changed',
  'user.password_reset_requested',
  'user.password_reset_completed',
  'user.email_verified',
  'user.session_revoked',
  'organization.invitation_created',
  'organization.invitation_accepted',
  'organization.member_role_changed',
  'organization.member_removed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface RecordAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  organizationId?: string;
  userId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-log, never fire-and-fail: a missing audit trail for one event
   * is bad, but it must never be the reason a real user action (login,
   * password reset, invite) fails — so a write error here is swallowed
   * after being surfaced through Nest's default logger, not rethrown.
   */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          organizationId: input.organizationId,
          userId: input.userId,
          ipAddress: input.ipAddress,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for action "${input.action}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Organization-scoped view (OWNER/ADMIN only) — membership/permission
   * events (invitations, role changes, removals). Deliberately does NOT
   * include personal account events (login, logout, password changes):
   * those have no natural single organization (a user can belong to
   * several, and login happens before any org context exists), so they're
   * never written with an organizationId — see `listForUser` for those.
   */
  async list(organizationId: string, dto: ListAuditLogsDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 25;
    const where = {
      organizationId,
      ...(dto.action ? { action: dto.action } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** A user's own personal security history — every event they were the actor of, self-scoped, no role gate needed since it's always their own data. */
  async listForUser(userId: string, dto: ListAuditLogsDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 25;
    const where = {
      userId,
      ...(dto.action ? { action: dto.action } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
