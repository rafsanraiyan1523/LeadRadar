import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@lead-radar/db';

export const ROLES_KEY = 'roles';

/** Restricts a route to members whose org role is one of `roles`. Requires OrgGuard to run first. */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
