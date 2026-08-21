import type { OrgRole } from '@lead-radar/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface ActiveMembership {
  organizationId: string;
  role: OrgRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      membership?: ActiveMembership;
    }
  }
}
