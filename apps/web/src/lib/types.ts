export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  memberships: { organizationId: string; organizationName: string; role: string }[];
}
