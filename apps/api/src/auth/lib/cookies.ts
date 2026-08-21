import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../../config/configuration';

export const ACCESS_TOKEN_COOKIE = 'lr_access_token';
export const REFRESH_TOKEN_COOKIE = 'lr_refresh_token';

function baseCookieOptions(config: Pick<AppConfig, 'nodeEnv'>): CookieOptions {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
  };
}

export function setAccessTokenCookie(
  res: Response,
  token: string,
  config: Pick<AppConfig, 'nodeEnv' | 'accessTokenTtlSeconds'>,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions(config),
    path: '/',
    maxAge: config.accessTokenTtlSeconds * 1000,
  });
}

export function setRefreshTokenCookie(
  res: Response,
  token: string,
  config: Pick<AppConfig, 'nodeEnv' | 'refreshTokenTtlDays'>,
): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(config),
    // Scoped to /auth so the high-value refresh token isn't attached to
    // every request — only the endpoints that need it (refresh, logout).
    path: '/auth',
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(
  res: Response,
  config: Pick<AppConfig, 'nodeEnv'>,
): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    ...baseCookieOptions(config),
    path: '/',
  });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseCookieOptions(config),
    path: '/auth',
  });
}
