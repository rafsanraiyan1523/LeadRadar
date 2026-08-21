import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, extractCookies, type TestApp } from './setup/test-app';
import type { MemoryMailProvider } from './setup/memory-mail.provider';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const PASSWORD = 'correct-horse-1';

async function registerUser(
  app: INestApplication<App>,
  email: string,
  organizationName: string,
) {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password: PASSWORD,
      name: email.split('@')[0],
      organizationName,
    });
  const cookies = extractCookies(res.headers['set-cookie']);
  const me = await request(app.getHttpServer())
    .get('/auth/me')
    .set('Cookie', [cookies]);
  return {
    cookies,
    userId: me.body.id as string,
    organizationId: me.body.memberships[0].organizationId as string,
  };
}

describe('Organizations (e2e)', () => {
  let app: INestApplication<App>;
  let mail: MemoryMailProvider;

  beforeAll(async () => {
    const testApp: TestApp = await createTestApp();
    app = testApp.app;
    mail = testApp.mail;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('organization isolation', () => {
    it("cannot read another organization's members even by guessing its id", async () => {
      const orgA = await registerUser(app, uniqueEmail('iso-a'), 'Org A');
      const orgB = await registerUser(app, uniqueEmail('iso-b'), 'Org B');

      const asOwnOrg = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [orgA.cookies]);
      expect(asOwnOrg.status).toBe(200);
      expect(asOwnOrg.body).toHaveLength(1);

      const crossOrgAttempt = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [orgA.cookies])
        .set('x-organization-id', orgB.organizationId);
      expect(crossOrgAttempt.status).toBe(403);
    });

    it('lists only the organizations the user actually belongs to', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('iso-list'),
        'Org List',
      );

      const res = await request(app.getHttpServer())
        .get('/organizations')
        .set('Cookie', [owner.cookies]);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].organizationId).toBe(owner.organizationId);
    });
  });

  describe('role permissions', () => {
    it('lets an owner invite a member, and the member can accept and join', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('role-owner'),
        'Role Org',
      );
      const inviteeEmail = uniqueEmail('role-invitee');

      const inviteRes = await request(app.getHttpServer())
        .post('/organizations/invitations')
        .set('Cookie', [owner.cookies])
        .send({ email: inviteeEmail, role: 'MEMBER' });
      expect(inviteRes.status).toBe(201);
      const token =
        inviteRes.body.token ??
        mail.extractToken(mail.latestFor(inviteeEmail)!);

      const invitee = await registerUser(
        app,
        inviteeEmail,
        "Invitee's Own Org",
      );

      const acceptRes = await request(app.getHttpServer())
        .post('/organizations/invitations/accept')
        .set('Cookie', [invitee.cookies])
        .send({ token });
      expect(acceptRes.status).toBe(201);
      expect(acceptRes.body.organizationId).toBe(owner.organizationId);

      const membersRes = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [invitee.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(membersRes.status).toBe(200);
      expect(membersRes.body).toHaveLength(2);
    });

    it('blocks a MEMBER from creating invitations in that organization', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('role-member-owner'),
        'Member Test Org',
      );
      const memberEmail = uniqueEmail('role-member');

      const inviteRes = await request(app.getHttpServer())
        .post('/organizations/invitations')
        .set('Cookie', [owner.cookies])
        .send({ email: memberEmail, role: 'MEMBER' });
      const token =
        inviteRes.body.token ?? mail.extractToken(mail.latestFor(memberEmail)!);

      const member = await registerUser(app, memberEmail, "Member's Own Org");
      await request(app.getHttpServer())
        .post('/organizations/invitations/accept')
        .set('Cookie', [member.cookies])
        .send({ token });

      const forbiddenInvite = await request(app.getHttpServer())
        .post('/organizations/invitations')
        .set('Cookie', [member.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ email: uniqueEmail('blocked'), role: 'MEMBER' });

      expect(forbiddenInvite.status).toBe(403);
    });

    it('only an owner can grant the ADMIN or OWNER role', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('role-grant-owner'),
        'Grant Test Org',
      );
      const adminEmail = uniqueEmail('role-grant-admin');

      const inviteRes = await request(app.getHttpServer())
        .post('/organizations/invitations')
        .set('Cookie', [owner.cookies])
        .send({ email: adminEmail, role: 'ADMIN' });
      const token =
        inviteRes.body.token ?? mail.extractToken(mail.latestFor(adminEmail)!);

      const admin = await registerUser(app, adminEmail, "Admin's Own Org");
      await request(app.getHttpServer())
        .post('/organizations/invitations/accept')
        .set('Cookie', [admin.cookies])
        .send({ token });

      const membersRes = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [owner.cookies]);
      const memberRow = membersRes.body.find(
        (m: { email: string }) => m.email === adminEmail,
      );

      // Admin tries to promote themselves to OWNER — must be rejected.
      const escalation = await request(app.getHttpServer())
        .patch(`/organizations/members/${memberRow.id}/role`)
        .set('Cookie', [admin.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ role: 'OWNER' });
      expect(escalation.status).toBe(403);
    });

    it('refuses to demote the last remaining owner', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('last-owner'),
        'Last Owner Org',
      );

      const membersRes = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [owner.cookies]);
      const ownerRow = membersRes.body.find(
        (m: { userId: string }) => m.userId === owner.userId,
      );

      const demote = await request(app.getHttpServer())
        .patch(`/organizations/members/${ownerRow.id}/role`)
        .set('Cookie', [owner.cookies])
        .send({ role: 'MEMBER' });

      expect(demote.status).toBe(400);
    });
  });

  describe('ambiguous organization context', () => {
    it('requires the x-organization-id header once a user belongs to more than one org', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('ambiguous-owner'),
        'Ambiguous Org',
      );
      const memberEmail = uniqueEmail('ambiguous-member');

      const inviteRes = await request(app.getHttpServer())
        .post('/organizations/invitations')
        .set('Cookie', [owner.cookies])
        .send({ email: memberEmail, role: 'MEMBER' });
      const token =
        inviteRes.body.token ?? mail.extractToken(mail.latestFor(memberEmail)!);

      const member = await registerUser(
        app,
        memberEmail,
        "Member's Second Org",
      );
      await request(app.getHttpServer())
        .post('/organizations/invitations/accept')
        .set('Cookie', [member.cookies])
        .send({ token });

      const noHeader = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [member.cookies]);
      expect(noHeader.status).toBe(400);

      const withHeader = await request(app.getHttpServer())
        .get('/organizations/members')
        .set('Cookie', [member.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(withHeader.status).toBe(200);
    });
  });
});
