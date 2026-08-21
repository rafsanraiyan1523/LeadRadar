export const AUDIT_ACTIONS = [
  "user.registered",
  "user.login",
  "user.logout",
  "user.password_changed",
  "user.password_reset_requested",
  "user.password_reset_completed",
  "user.email_verified",
  "user.session_revoked",
  "organization.invitation_created",
  "organization.invitation_accepted",
  "organization.member_role_changed",
  "organization.member_removed",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  organizationId: string | null;
  userId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

export interface PaginatedAuditLog {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "user.registered": "Account registered",
  "user.login": "Signed in",
  "user.logout": "Signed out",
  "user.password_changed": "Password changed",
  "user.password_reset_requested": "Password reset requested",
  "user.password_reset_completed": "Password reset completed",
  "user.email_verified": "Email verified",
  "user.session_revoked": "Session revoked",
  "organization.invitation_created": "Invitation sent",
  "organization.invitation_accepted": "Invitation accepted",
  "organization.member_role_changed": "Member role changed",
  "organization.member_removed": "Member removed",
};
