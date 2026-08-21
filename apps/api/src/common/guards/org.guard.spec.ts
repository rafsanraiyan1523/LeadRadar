import type { ExecutionContext } from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgGuard, ORGANIZATION_HEADER } from './org.guard';
import type { PrismaService } from '../../prisma/prisma.service';

function makeContext(
  user: { id: string } | undefined,
  headers: Record<string, string> = {},
) {
  const request: Record<string, unknown> = { user, headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('OrgGuard', () => {
  it('rejects when there is no authenticated user', async () => {
    const prisma = {
      organizationMember: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const guard = new OrgGuard(prisma);
    const { context } = makeContext(undefined);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a user with no organization memberships', async () => {
    const prisma = {
      organizationMember: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const guard = new OrgGuard(prisma);
    const { context } = makeContext({ id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('auto-resolves the sole membership when no header is given', async () => {
    const membership = { organizationId: 'org-1', role: 'OWNER' };
    const prisma = {
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([membership]),
      },
    } as unknown as PrismaService;
    const guard = new OrgGuard(prisma);
    const { context, request } = makeContext({ id: 'u1' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.membership).toEqual(membership);
  });

  it('requires the header when the user belongs to multiple organizations', async () => {
    const prisma = {
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([
          { organizationId: 'org-1', role: 'OWNER' },
          { organizationId: 'org-2', role: 'MEMBER' },
        ]),
      },
    } as unknown as PrismaService;
    const guard = new OrgGuard(prisma);
    const { context } = makeContext({ id: 'u1' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects access to an organization the user is not a member of — the isolation boundary', async () => {
    const prisma = {
      organizationMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ organizationId: 'org-1', role: 'OWNER' }]),
      },
    } as unknown as PrismaService;
    const guard = new OrgGuard(prisma);
    const { context } = makeContext(
      { id: 'u1' },
      { [ORGANIZATION_HEADER]: 'org-owned-by-someone-else' },
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('honors an explicit header that matches an actual membership', async () => {
    const memberships = [
      { organizationId: 'org-1', role: 'OWNER' },
      { organizationId: 'org-2', role: 'MEMBER' },
    ];
    const prisma = {
      organizationMember: {
        findMany: jest.fn().mockResolvedValue(memberships),
      },
    } as unknown as PrismaService;
    const guard = new OrgGuard(prisma);
    const { context, request } = makeContext(
      { id: 'u1' },
      { [ORGANIZATION_HEADER]: 'org-2' },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.membership).toEqual(memberships[1]);
  });
});
