import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RefreshSession, User } from '@lead-radar/db';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UsersService } from '../users/users.service';
import {
  MAIL_PROVIDER,
  type MailProvider,
} from '../mail/mail-provider.interface';
import { slugify, withUniqueSuffix } from '../common/lib/slug';
import type { AppConfig } from '../config/configuration';
import { hashPassword, verifyPassword } from './lib/password';
import { generateOpaqueToken, hashToken } from './lib/tokens';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly auditLog: AuditLogService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthResult> {
    const email = dto.email.toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const baseSlug = slugify(dto.organizationName);

    const { user } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email, passwordHash, name: dto.name },
      });

      const organization = await tx.organization.create({
        data: { name: dto.organizationName, slug: withUniqueSuffix(baseSlug) },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          role: 'OWNER',
        },
      });

      // Written via `tx` directly (not AuditLogService.record) so it's part
      // of the same atomic transaction as the user/org/membership rows —
      // if any of those roll back, there's no orphan audit entry.
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          action: 'user.registered',
          entityType: 'User',
          entityId: createdUser.id,
          ipAddress: ctx.ipAddress,
        },
      });

      return { user: createdUser, organization };
    });

    await this.sendEmailVerification(user);

    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshSession(user.id, ctx);

    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    const invalidCredentials = new UnauthorizedException(
      'Invalid email or password',
    );

    if (!user || user.status !== 'ACTIVE') {
      throw invalidCredentials;
    }

    const passwordValid = await verifyPassword(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw invalidCredentials;
    }

    await this.auditLog.record({
      action: 'user.login',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      ipAddress: ctx.ipAddress,
    });

    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshSession(user.id, ctx);

    return { user: toPublicUser(user), accessToken, refreshToken };
  }

  async refresh(
    refreshTokenRaw: string,
    ctx: RequestContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = hashToken(refreshTokenRaw);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.revokedAt) {
      // This token was already rotated (or explicitly revoked) once before.
      // Seeing it again means it leaked — kill every session for this user.
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Session reuse detected — all sessions revoked',
      );
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.users.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid session');
    }

    const newRefreshToken = await this.issueRefreshSession(user.id, ctx);
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenHash: hashToken(newRefreshToken),
      },
    });

    const accessToken = await this.issueAccessToken(user);
    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(
    userId: string,
    refreshTokenRaw: string | undefined,
    ctx: RequestContext,
  ): Promise<void> {
    if (refreshTokenRaw) {
      const tokenHash = hashToken(refreshTokenRaw);
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.auditLog.record({
      action: 'user.logout',
      entityType: 'User',
      entityId: userId,
      userId,
      ipAddress: ctx.ipAddress,
    });
  }

  async me(userId: string): Promise<
    PublicUser & {
      memberships: {
        organizationId: string;
        organizationName: string;
        role: string;
      }[];
    }
  > {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { organization: true } } },
    });

    return {
      ...toPublicUser(user),
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organization.name,
        role: m.role,
      })),
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    // Always behave the same regardless of whether the account exists, to
    // avoid leaking which emails are registered.
    if (!user) {
      return;
    }

    const { token, tokenHash } = generateOpaqueToken();
    const ttlMinutes = this.config.get('passwordResetTtlMinutes', {
      infer: true,
    });
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });

    const resetUrl = `${this.config.get('webOrigin', { infer: true })}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Reset your LeadRadar password',
      text: `Reset your password: ${resetUrl}\n\nThis link expires in ${ttlMinutes} minutes. If you didn't request this, you can ignore this email.`,
    });

    await this.auditLog.record({
      action: 'user.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
    });
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<void> {
    const tokenHash = hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const passwordHash = await hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      action: 'user.password_reset_completed',
      entityType: 'User',
      entityId: resetToken.userId,
      userId: resetToken.userId,
      ipAddress: ctx.ipAddress,
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepSessionTokenHash: string | undefined,
    ctx: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await verifyPassword(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(keepSessionTokenHash
            ? { tokenHash: { not: keepSessionTokenHash } }
            : {}),
        },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      action: 'user.password_changed',
      entityType: 'User',
      entityId: userId,
      userId,
      ipAddress: ctx.ipAddress,
    });
  }

  async sendEmailVerification(user: User): Promise<void> {
    if (user.emailVerifiedAt) {
      return;
    }

    const { token, tokenHash } = generateOpaqueToken();
    const ttlHours = this.config.get('emailVerificationTtlHours', {
      infer: true,
    });
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${this.config.get('webOrigin', { infer: true })}/verify-email?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Verify your LeadRadar email',
      text: `Confirm your email: ${verifyUrl}\n\nThis link expires in ${ttlHours} hours.`,
    });
  }

  async resendEmailVerification(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.emailVerifiedAt) {
      return { sent: false };
    }
    await this.sendEmailVerification(user);
    return { sent: true };
  }

  async confirmEmailVerification(
    token: string,
    ctx: RequestContext,
  ): Promise<void> {
    const tokenHash = hashToken(token);
    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

    if (
      !verificationToken ||
      verificationToken.consumedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired verification link');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    await this.auditLog.record({
      action: 'user.email_verified',
      entityType: 'User',
      entityId: verificationToken.userId,
      userId: verificationToken.userId,
      ipAddress: ctx.ipAddress,
    });
  }

  async listSessions(userId: string): Promise<RefreshSession[]> {
    return this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    ctx: RequestContext,
  ): Promise<void> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new ForbiddenException('Session not found');
    }
    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.auditLog.record({
      action: 'user.session_revoked',
      entityType: 'RefreshSession',
      entityId: sessionId,
      userId,
      ipAddress: ctx.ipAddress,
    });
  }

  private async issueAccessToken(user: User): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.config.get('jwtSecret', { infer: true }),
        expiresIn: this.config.get('accessTokenTtlSeconds', { infer: true }),
      },
    );
  }

  private async issueRefreshSession(
    userId: string,
    ctx: RequestContext,
  ): Promise<string> {
    const { token, tokenHash } = generateOpaqueToken();
    const ttlDays = this.config.get('refreshTokenTtlDays', { infer: true });
    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });
    return token;
  }
}
