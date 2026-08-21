import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/express';
import type { AppConfig } from '../config/configuration';
import { AuthService, type RequestContext } from './auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListAuditLogsDto } from '../audit-log/dto/list-audit-logs.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from './lib/cookies';

// A generous limit in tests avoids the brute-force guard tripping over the
// suite's own rapid-fire register/login calls rather than real abuse.
const AUTH_THROTTLE = {
  default: { limit: process.env.NODE_ENV === 'test' ? 1000 : 5, ttl: 60_000 },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly auditLog: AuditLogService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto,
      this.requestContext(req),
    );
    this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.requestContext(req));
    this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('No session to refresh');
    }
    const result = await this.authService.refresh(
      refreshToken,
      this.requestContext(req),
    );
    this.setSessionCookies(res, result.accessToken, result.refreshToken);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    await this.authService.logout(
      user.id,
      refreshToken,
      this.requestContext(req),
    );
    clearAuthCookies(res, {
      nodeEnv: this.config.get('nodeEnv', { infer: true }),
    });
    return { ok: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      this.requestContext(req),
    );
    return { ok: true };
  }

  @Public()
  @Post('verify-email/confirm')
  @HttpCode(200)
  async confirmEmailVerification(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
  ) {
    await this.authService.confirmEmailVerification(
      dto.token,
      this.requestContext(req),
    );
    return { ok: true };
  }

  @Throttle(AUTH_THROTTLE)
  @Post('verify-email/resend')
  @HttpCode(200)
  async resendEmailVerification(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.authService.resendEmailVerification(user.id);
    return { ok: true, alreadyVerified: !result.sent };
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as
      string | undefined;
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      currentRefreshToken,
      this.requestContext(req),
    );
    return { ok: true };
  }

  /** A user's own personal security history — self-scoped, no org/role gate needed since it's always their own data. */
  @Get('audit-log')
  async myAuditLog(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListAuditLogsDto,
  ) {
    return this.auditLog.listForUser(user.id, dto);
  }

  @Get('sessions')
  async sessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.authService.listSessions(user.id);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(200)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    await this.authService.revokeSession(user.id, id, this.requestContext(req));
    return { ok: true };
  }

  private setSessionCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const cookieConfig = {
      nodeEnv: this.config.get('nodeEnv', { infer: true }),
      accessTokenTtlSeconds: this.config.get('accessTokenTtlSeconds', {
        infer: true,
      }),
      refreshTokenTtlDays: this.config.get('refreshTokenTtlDays', {
        infer: true,
      }),
    };
    setAccessTokenCookie(res, accessToken, cookieConfig);
    setRefreshTokenCookie(res, refreshToken, cookieConfig);
  }

  private requestContext(req: Request): RequestContext {
    return {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };
  }
}
