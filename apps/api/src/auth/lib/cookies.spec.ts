import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from './cookies';

// Deliberately *not* typed/intersected as `Response` — `Response.cookie`/
// `.clearCookie` are real interface methods, and referencing them bare (as
// `expect(res.cookie)...` does) would trip @typescript-eslint/unbound-method
// if TS still saw them as methods of that interface rather than plain mock
// function properties. `res` is only cast to `Response` at the call site
// below, where it's actually passed into the functions under test.
interface MockRes {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

function mockResponse(): MockRes {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

const DEV_CONFIG = {
  nodeEnv: 'development',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
};
const PROD_CONFIG = {
  nodeEnv: 'production',
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 30,
};

describe('auth cookies', () => {
  describe('development (nodeEnv !== production)', () => {
    it('sets the access token cookie as Lax, non-Secure — plain HTTP localhost keeps working', () => {
      const res = mockResponse();
      setAccessTokenCookie(
        res as unknown as Response,
        'token-value',
        DEV_CONFIG,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'token-value',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
        }),
      );
    });

    it('sets the refresh token cookie as Lax, non-Secure, scoped to /auth', () => {
      const res = mockResponse();
      setRefreshTokenCookie(
        res as unknown as Response,
        'refresh-value',
        DEV_CONFIG,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'refresh-value',
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/auth',
        }),
      );
    });
  });

  describe('production (cross-domain: Vercel frontend, Render API)', () => {
    it('sets the access token cookie as SameSite=None + Secure — required for the browser to attach it to a cross-site API call', () => {
      const res = mockResponse();
      setAccessTokenCookie(
        res as unknown as Response,
        'token-value',
        PROD_CONFIG,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'token-value',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
    });

    it('sets the refresh token cookie as SameSite=None + Secure, still scoped to /auth', () => {
      const res = mockResponse();
      setRefreshTokenCookie(
        res as unknown as Response,
        'refresh-value',
        PROD_CONFIG,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'refresh-value',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/auth',
        }),
      );
    });

    it('never sets SameSite=None without Secure — browsers silently reject that combination', () => {
      const res = mockResponse();
      setAccessTokenCookie(
        res as unknown as Response,
        'token-value',
        PROD_CONFIG,
      );
      setRefreshTokenCookie(
        res as unknown as Response,
        'refresh-value',
        PROD_CONFIG,
      );

      for (const call of res.cookie.mock.calls as unknown as [
        string,
        string,
        { sameSite?: string; secure?: boolean },
      ][]) {
        const options = call[2];
        if (options.sameSite === 'none') {
          expect(options.secure).toBe(true);
        }
      }
    });

    it('clears both cookies with matching attributes (path + sameSite + secure) so the browser actually deletes them', () => {
      const res = mockResponse();
      clearAuthCookies(res as unknown as Response, PROD_CONFIG);

      expect(res.clearCookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/',
        }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          path: '/auth',
        }),
      );
    });
  });

  describe('expiration', () => {
    it("sets the access token's maxAge from accessTokenTtlSeconds", () => {
      const res = mockResponse();
      setAccessTokenCookie(res as unknown as Response, 'token-value', {
        ...DEV_CONFIG,
        accessTokenTtlSeconds: 60,
      });

      expect(res.cookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        'token-value',
        expect.objectContaining({ maxAge: 60_000 }),
      );
    });

    it("sets the refresh token's maxAge from refreshTokenTtlDays", () => {
      const res = mockResponse();
      setRefreshTokenCookie(res as unknown as Response, 'refresh-value', {
        ...DEV_CONFIG,
        refreshTokenTtlDays: 1,
      });

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'refresh-value',
        expect.objectContaining({ maxAge: 24 * 60 * 60 * 1000 }),
      );
    });
  });

  describe('clearAuthCookies in development', () => {
    it('clears both cookies with Lax, non-Secure attributes matching how they were set', () => {
      const res = mockResponse();
      clearAuthCookies(res as unknown as Response, DEV_CONFIG);

      expect(res.clearCookie).toHaveBeenCalledWith(
        ACCESS_TOKEN_COOKIE,
        expect.objectContaining({ secure: false, sameSite: 'lax', path: '/' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        expect.objectContaining({
          secure: false,
          sameSite: 'lax',
          path: '/auth',
        }),
      );
    });
  });

  it('never sets a domain attribute — frontend and API are entirely separate domains, not subdomains of one site, so a Domain attribute would be meaningless (and could not be shared between them anyway)', () => {
    const res = mockResponse();
    setAccessTokenCookie(
      res as unknown as Response,
      'token-value',
      PROD_CONFIG,
    );
    setRefreshTokenCookie(
      res as unknown as Response,
      'refresh-value',
      PROD_CONFIG,
    );
    clearAuthCookies(res as unknown as Response, PROD_CONFIG);

    for (const call of res.cookie.mock.calls as unknown as [
      string,
      string,
      { domain?: string },
    ][]) {
      expect(call[2].domain).toBeUndefined();
    }
    for (const call of res.clearCookie.mock.calls as unknown as [
      string,
      { domain?: string },
    ][]) {
      expect(call[1].domain).toBeUndefined();
    }
  });
});
