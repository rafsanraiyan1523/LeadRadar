import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(role: string | undefined) {
  const request = {
    membership: role ? { organizationId: 'org-1', role } : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows any role when the route declares no @Roles()', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext('VIEWER'))).toBe(true);
  });

  it('allows a member whose role is in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['OWNER', 'ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('denies a member whose role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['OWNER', 'ADMIN']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(makeContext('MEMBER'))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when there is no resolved membership at all', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['OWNER']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
