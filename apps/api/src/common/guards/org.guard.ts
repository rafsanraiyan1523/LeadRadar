import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export const ORGANIZATION_HEADER = 'x-organization-id';

/**
 * Resolves the organization the request is acting within and attaches it as
 * `request.membership`. This is the sole mechanism by which org-scoped data
 * is reached — every org-scoped query must filter by `request.membership.organizationId`,
 * never by a client-supplied id that hasn't passed through here. Must run
 * after JwtAuthGuard (needs `request.user`).
 */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId: request.user.id },
      select: { organizationId: true, role: true },
    });

    if (memberships.length === 0) {
      throw new ForbiddenException('You do not belong to any organization');
    }

    const requestedOrgId = request.headers[ORGANIZATION_HEADER] as
      string | undefined;

    if (requestedOrgId) {
      const membership = memberships.find(
        (m) => m.organizationId === requestedOrgId,
      );
      if (!membership) {
        throw new ForbiddenException(
          'You are not a member of this organization',
        );
      }
      request.membership = membership;
      return true;
    }

    const [onlyMembership] = memberships;
    if (memberships.length > 1 || !onlyMembership) {
      throw new BadRequestException(
        `Ambiguous organization context — specify the ${ORGANIZATION_HEADER} header`,
      );
    }

    request.membership = onlyMembership;
    return true;
  }
}
