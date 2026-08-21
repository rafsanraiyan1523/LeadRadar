import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ACCESS_TOKEN_COOKIE } from '../../auth/lib/cookies';

function makeContext(cookies: Record<string, string> = {}): ExecutionContext {
  const request = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const config = { get: () => 'test-secret' } as unknown as ConfigService;

  it('allows access to routes marked @Public() without a token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector, jwt, config as never);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- standard Jest `expect(mock.method)` idiom, never actually calls with `this`
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects a request with no access-token cookie', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector, jwt, config as never);

    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid or expired token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('bad signature')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector, jwt, config as never);

    await expect(
      guard.canActivate(makeContext({ [ACCESS_TOKEN_COOKIE]: 'garbage' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the decoded user to the request on a valid token', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: 'user-1', email: 'a@example.com' }),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector, jwt, config as never);
    const context = makeContext({ [ACCESS_TOKEN_COOKIE]: 'valid' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    expect(request.user).toEqual({ id: 'user-1', email: 'a@example.com' });
  });
});
