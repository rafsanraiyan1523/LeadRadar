import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrgRole } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  MAIL_PROVIDER,
  type MailProvider,
} from '../mail/mail-provider.interface';
import { generateOpaqueToken, hashToken } from '../auth/lib/tokens';
import type { AppConfig } from '../config/configuration';
import type { CreateInvitationDto } from './dto/create-invitation.dto';

const ROLES_ONLY_OWNER_CAN_GRANT: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly auditLog: AuditLogService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      organizationId: m.organizationId,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }));
  }

  async listMembers(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt,
    }));
  }

  async createInvitation(
    organizationId: string,
    invitedByUserId: string,
    inviterRole: OrgRole,
    dto: CreateInvitationDto,
    ipAddress?: string,
  ) {
    const role = dto.role ?? OrgRole.MEMBER;
    if (
      ROLES_ONLY_OWNER_CAN_GRANT.includes(role) &&
      inviterRole !== OrgRole.OWNER
    ) {
      throw new ForbiddenException(
        'Only an owner can invite an admin or owner',
      );
    }

    const email = dto.email.toLowerCase();
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId, user: { email } },
    });
    if (existingMember) {
      throw new ConflictException(
        'This person is already a member of the organization',
      );
    }

    const { token, tokenHash } = generateOpaqueToken();
    const ttlDays = this.config.get('invitationTtlDays', { infer: true });

    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { organizationId, email, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      return tx.invitation.create({
        data: {
          organizationId,
          email,
          role,
          tokenHash,
          invitedByUserId,
          expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        },
      });
    });

    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const acceptUrl = `${this.config.get('webOrigin', { infer: true })}/accept-invitation?token=${token}`;
    await this.mail.send({
      to: email,
      subject: `You're invited to join ${organization.name} on LeadRadar`,
      text: `You've been invited to join ${organization.name} as ${role.toLowerCase()}.\n\nAccept: ${acceptUrl}\n\nThis invitation expires in ${ttlDays} days.`,
    });

    await this.auditLog.record({
      action: 'organization.invitation_created',
      entityType: 'Invitation',
      entityId: invitation.id,
      organizationId,
      userId: invitedByUserId,
      ipAddress,
      metadata: { email, role },
    });

    const isProduction =
      this.config.get('nodeEnv', { infer: true }) === 'production';
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      // Only surfaced outside production, where there's no real inbox to
      // deliver to — keeps register→invite→accept demoable at zero cost.
      token: isProduction ? undefined : token,
    };
  }

  async acceptInvitation(
    userId: string,
    userEmail: string,
    token: string,
    ipAddress?: string,
  ) {
    const tokenHash = hashToken(token);
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    if (invitation.email !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        },
        update: {},
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    });

    await this.auditLog.record({
      action: 'organization.invitation_accepted',
      entityType: 'Invitation',
      entityId: invitation.id,
      organizationId: invitation.organizationId,
      userId,
      ipAddress,
    });

    return { organizationId: invitation.organizationId };
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: OrgRole,
    actingRole: OrgRole,
    actingUserId: string,
    ipAddress?: string,
  ) {
    const member = await this.getMemberOrThrow(organizationId, memberId);
    this.assertCanManage(actingRole, member.role);
    if (
      ROLES_ONLY_OWNER_CAN_GRANT.includes(newRole) &&
      actingRole !== OrgRole.OWNER
    ) {
      throw new ForbiddenException('Only an owner can grant admin or owner');
    }

    if (member.role === OrgRole.OWNER && newRole !== OrgRole.OWNER) {
      await this.assertNotLastOwner(organizationId);
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
    });

    await this.auditLog.record({
      action: 'organization.member_role_changed',
      entityType: 'OrganizationMember',
      entityId: memberId,
      organizationId,
      userId: actingUserId,
      ipAddress,
      metadata: { targetUserId: member.userId, from: member.role, to: newRole },
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actingRole: OrgRole,
    actingUserId: string,
    ipAddress?: string,
  ) {
    const member = await this.getMemberOrThrow(organizationId, memberId);
    this.assertCanManage(actingRole, member.role);

    if (member.role === OrgRole.OWNER) {
      await this.assertNotLastOwner(organizationId);
    }

    await this.prisma.organizationMember.delete({ where: { id: memberId } });

    await this.auditLog.record({
      action: 'organization.member_removed',
      entityType: 'OrganizationMember',
      entityId: memberId,
      organizationId,
      userId: actingUserId,
      ipAddress,
      metadata: { targetUserId: member.userId, role: member.role },
    });
  }

  /** Admins may only manage members/viewers; only an owner may manage an owner or admin. */
  private assertCanManage(actingRole: OrgRole, targetRole: OrgRole): void {
    if (actingRole === OrgRole.OWNER) {
      return;
    }
    if (ROLES_ONLY_OWNER_CAN_GRANT.includes(targetRole)) {
      throw new ForbiddenException(
        'Only an owner can manage an admin or owner',
      );
    }
  }

  private async getMemberOrThrow(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }
    return member;
  }

  private async assertNotLastOwner(organizationId: string): Promise<void> {
    const ownerCount = await this.prisma.organizationMember.count({
      where: { organizationId, role: OrgRole.OWNER },
    });
    if (ownerCount <= 1) {
      throw new BadRequestException(
        'An organization must have at least one owner',
      );
    }
  }
}
