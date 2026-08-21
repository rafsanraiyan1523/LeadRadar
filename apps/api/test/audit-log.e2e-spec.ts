import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, extractCookies, type TestApp } from './setup/test-app';
import type { PrismaService } from '../src/prisma/prisma.service';

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

async function addMember(
  prisma: PrismaService,
  organizationId: string,
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER',
) {
  await prisma.organizationMember.create({
    data: { organizationId, userId, role },
  });
}

describe('Audit Log (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp: TestApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/audit-logs').expect(401);
  });

  it('records registration on the organization-scoped log', async () => {
    const { cookies, organizationId, userId } = await registerUser(
      app,
      uniqueEmail('audit-basic'),
      'Audit Org',
    );

    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Cookie', [cookies]);

    expect(res.status).toBe(200);
    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('user.registered');
    expect(res.body.items[0].organizationId).toBe(organizationId);
    expect(
      res.body.items.every((i: { userId: string }) => i.userId === userId),
    ).toBe(true);
  });

  it("records login, logout, and password change on the user's personal audit log", async () => {
    const email = uniqueEmail('audit-session');
    const { cookies } = await registerUser(app, email, 'Audit Org');

    // A second login (past registration's own auto-login) generates a
    // distinct, independently-verifiable event.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Cookie', [cookies])
      .send({ currentPassword: PASSWORD, newPassword: 'new-correct-horse-2' });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', [cookies]);

    // Log back in (with the new password) to read the trail, since logout
    // revoked the session used above.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'new-correct-horse-2' });
    const freshCookies = extractCookies(login.headers['set-cookie']);

    const res = await request(app.getHttpServer())
      .get('/auth/audit-log')
      .set('Cookie', [freshCookies]);

    expect(res.status).toBe(200);
    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('user.registered');
    expect(actions).toContain('user.login');
    expect(actions).toContain('user.password_changed');
    expect(actions).toContain('user.logout');

    // Login/logout/password events are never organization-scoped — no
    // natural single org (login happens before any org context exists, and
    // a user can belong to several) — only registration carries one.
    const loginEvent = res.body.items.find(
      (i: { action: string }) => i.action === 'user.login',
    );
    expect(loginEvent.organizationId).toBeNull();
  });

  it("never leaks another user's personal audit log", async () => {
    const userA = await registerUser(
      app,
      uniqueEmail('audit-personal-a'),
      'Org A',
    );
    const userB = await registerUser(
      app,
      uniqueEmail('audit-personal-b'),
      'Org B',
    );

    const res = await request(app.getHttpServer())
      .get('/auth/audit-log')
      .set('Cookie', [userB.cookies]);

    expect(
      res.body.items.every(
        (i: { userId: string }) => i.userId === userB.userId,
      ),
    ).toBe(true);
    expect(
      res.body.items.some((i: { userId: string }) => i.userId === userA.userId),
    ).toBe(false);
  });

  it('records invitation creation and member role/removal changes', async () => {
    const owner = await registerUser(
      app,
      uniqueEmail('audit-org-owner'),
      'Audit Org',
    );

    const invite = await request(app.getHttpServer())
      .post('/organizations/invitations')
      .set('Cookie', [owner.cookies])
      .send({ email: uniqueEmail('audit-invitee'), role: 'MEMBER' });
    expect(invite.status).toBe(201);

    const memberUser = await registerUser(
      app,
      uniqueEmail('audit-target-member'),
      'Solo Org For Target',
    );
    await addMember(prisma, owner.organizationId, memberUser.userId, 'VIEWER');
    const memberRow = await prisma.organizationMember.findFirstOrThrow({
      where: {
        organizationId: owner.organizationId,
        userId: memberUser.userId,
      },
    });

    await request(app.getHttpServer())
      .patch(`/organizations/members/${memberRow.id}/role`)
      .set('Cookie', [owner.cookies])
      .send({ role: 'MEMBER' });

    await request(app.getHttpServer())
      .delete(`/organizations/members/${memberRow.id}`)
      .set('Cookie', [owner.cookies]);

    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .set('Cookie', [owner.cookies]);

    const actions = res.body.items.map((i: { action: string }) => i.action);
    expect(actions).toContain('organization.invitation_created');
    expect(actions).toContain('organization.member_role_changed');
    expect(actions).toContain('organization.member_removed');
  });

  it('filters by action', async () => {
    const { cookies } = await registerUser(
      app,
      uniqueEmail('audit-filter'),
      'Audit Org',
    );

    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ action: 'user.login' })
      .set('Cookie', [cookies]);

    expect(res.status).toBe(200);
    expect(
      res.body.items.every(
        (i: { action: string }) => i.action === 'user.login',
      ),
    ).toBe(true);
  });

  it('rejects an unrecognized action filter', async () => {
    const { cookies } = await registerUser(
      app,
      uniqueEmail('audit-badfilter'),
      'Audit Org',
    );

    const res = await request(app.getHttpServer())
      .get('/audit-logs')
      .query({ action: 'not.a.real.action' })
      .set('Cookie', [cookies]);

    expect(res.status).toBe(400);
  });

  describe('organization isolation', () => {
    it("never returns another organization's audit entries", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('audit-iso-a'),
        'Iso Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('audit-iso-b'),
        'Iso Org B',
      );

      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Cookie', [orgB.cookies]);

      expect(
        res.body.items.every(
          (i: { organizationId: string }) =>
            i.organizationId === orgB.organizationId,
        ),
      ).toBe(true);
      expect(
        res.body.items.some(
          (i: { organizationId: string }) =>
            i.organizationId === orgA.organizationId,
        ),
      ).toBe(false);
    });
  });

  describe('permissions', () => {
    it('blocks a VIEWER and MEMBER from reading the audit log', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('audit-perm-owner'),
        'Perm Org',
      );
      const viewer = await registerUser(
        app,
        uniqueEmail('audit-perm-viewer'),
        'Viewer Solo Org',
      );
      const member = await registerUser(
        app,
        uniqueEmail('audit-perm-member'),
        'Member Solo Org',
      );
      await addMember(prisma, owner.organizationId, viewer.userId, 'VIEWER');
      await addMember(prisma, owner.organizationId, member.userId, 'MEMBER');

      const viewerRes = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(viewerRes.status).toBe(403);

      const memberRes = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Cookie', [member.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(memberRes.status).toBe(403);

      const ownerRes = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Cookie', [owner.cookies]);
      expect(ownerRes.status).toBe(200);
    });
  });
});
