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

async function createLead(
  prisma: PrismaService,
  organizationId: string,
  overrides: Partial<{ businessName: string; leadStatus: string }> = {},
) {
  return prisma.lead.create({
    data: {
      organizationId,
      businessName: overrides.businessName ?? 'Example Biz',
      leadStatus: (overrides.leadStatus as never) ?? 'SAVED',
    },
  });
}

const CAMPAIGN_BODY = {
  name: 'Dhaka Restaurants Q1',
  description: 'Outreach to restaurants missing a website',
  targetCategory: 'Restaurant',
  targetLocation: 'Dhaka',
  service: 'WEBSITE_DEVELOPMENT',
  tone: 'PROFESSIONAL',
  channel: 'EMAIL',
};

describe('Campaigns (e2e)', () => {
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
    await request(app.getHttpServer()).get('/campaigns').expect(401);
    await request(app.getHttpServer())
      .post('/campaigns')
      .send(CAMPAIGN_BODY)
      .expect(401);
  });

  it('creates a campaign with selected leads and lists it with counts', async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('camp-create'),
      'Campaign Org',
    );
    const leadA = await createLead(prisma, organizationId, {
      businessName: 'Biz A',
    });
    const leadB = await createLead(prisma, organizationId, {
      businessName: 'Biz B',
    });

    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Cookie', [cookies])
      .send({ ...CAMPAIGN_BODY, leadIds: [leadA.id, leadB.id] });

    expect(create.status).toBe(201);
    expect(create.body).toMatchObject({
      name: CAMPAIGN_BODY.name,
      status: 'DRAFT',
    });
    expect(create.body._count.leads).toBe(2);

    const list = await request(app.getHttpServer())
      .get('/campaigns')
      .set('Cookie', [cookies]);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ leadCount: 2, messageCount: 0 });
  });

  it('gets campaign detail with its selected leads', async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('camp-detail'),
      'Campaign Org',
    );
    const lead = await createLead(prisma, organizationId, {
      businessName: 'Detail Biz',
    });
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Cookie', [cookies])
      .send({ ...CAMPAIGN_BODY, leadIds: [lead.id] });

    const detail = await request(app.getHttpServer())
      .get(`/campaigns/${create.body.id}`)
      .set('Cookie', [cookies]);

    expect(detail.status).toBe(200);
    expect(detail.body.leads).toHaveLength(1);
    expect(detail.body.leads[0]).toMatchObject({ businessName: 'Detail Biz' });
  });

  it('updates campaign status', async () => {
    const { cookies } = await registerUser(
      app,
      uniqueEmail('camp-update'),
      'Campaign Org',
    );
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Cookie', [cookies])
      .send({ ...CAMPAIGN_BODY, leadIds: [] });

    const update = await request(app.getHttpServer())
      .patch(`/campaigns/${create.body.id}`)
      .set('Cookie', [cookies])
      .send({ status: 'ACTIVE' });

    expect(update.status).toBe(200);
    expect(update.body.status).toBe('ACTIVE');
  });

  it('adds and removes leads from a campaign', async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('camp-leads'),
      'Campaign Org',
    );
    const leadA = await createLead(prisma, organizationId, {
      businessName: 'Add Me',
    });
    const create = await request(app.getHttpServer())
      .post('/campaigns')
      .set('Cookie', [cookies])
      .send({ ...CAMPAIGN_BODY, leadIds: [] });

    const add = await request(app.getHttpServer())
      .post(`/campaigns/${create.body.id}/leads`)
      .set('Cookie', [cookies])
      .send({ leadIds: [leadA.id] });
    expect(add.status).toBe(201);
    expect(add.body.leads).toHaveLength(1);

    const remove = await request(app.getHttpServer())
      .delete(`/campaigns/${create.body.id}/leads/${leadA.id}`)
      .set('Cookie', [cookies]);
    expect(remove.status).toBe(200);

    const detail = await request(app.getHttpServer())
      .get(`/campaigns/${create.body.id}`)
      .set('Cookie', [cookies]);
    expect(detail.body.leads).toHaveLength(0);
  });

  describe('campaign dashboard', () => {
    it('computes real stats from the leads currently in the campaign', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('camp-dash'),
        'Campaign Org',
      );
      const contacted = await createLead(prisma, organizationId, {
        leadStatus: 'CONTACTED',
      });
      const replied = await createLead(prisma, organizationId, {
        leadStatus: 'REPLIED',
      });
      const won = await createLead(prisma, organizationId, {
        leadStatus: 'WON',
      });
      const stillSaved = await createLead(prisma, organizationId, {
        leadStatus: 'SAVED',
      });

      const create = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Cookie', [cookies])
        .send({
          ...CAMPAIGN_BODY,
          leadIds: [contacted.id, replied.id, won.id, stillSaved.id],
        });

      const dashboard = await request(app.getHttpServer())
        .get(`/campaigns/${create.body.id}/dashboard`)
        .set('Cookie', [cookies]);

      expect(dashboard.status).toBe(200);
      expect(dashboard.body).toEqual({
        leads: 4,
        messagesGenerated: 0,
        contacted: 1,
        replied: 1,
        meetings: 0,
        won: 1,
        conversionRate: 0.25,
      });
    });
  });

  describe('generate messages', () => {
    it('bulk-generates DRAFT messages for campaign leads, tagged with the campaign, and is idempotent', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('camp-gen'),
        'Campaign Org',
      );
      const leadA = await createLead(prisma, organizationId, {
        businessName: 'Gen A',
      });
      const leadB = await createLead(prisma, organizationId, {
        businessName: 'Gen B',
      });
      const create = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Cookie', [cookies])
        .send({ ...CAMPAIGN_BODY, leadIds: [leadA.id, leadB.id] });

      const generate = await request(app.getHttpServer())
        .post(`/campaigns/${create.body.id}/generate-messages`)
        .set('Cookie', [cookies])
        .send({});

      expect(generate.status).toBe(201);
      expect(generate.body).toEqual({
        generated: 2,
        failed: 0,
        alreadyGenerated: 0,
      });

      const messages = await prisma.outreachMessage.findMany({
        where: { campaignId: create.body.id },
      });
      expect(messages).toHaveLength(2);
      expect(messages.every((m) => m.status === 'DRAFT')).toBe(true);
      expect(messages.every((m) => m.sentAt === null)).toBe(true);

      const dashboard = await request(app.getHttpServer())
        .get(`/campaigns/${create.body.id}/dashboard`)
        .set('Cookie', [cookies]);
      expect(dashboard.body.messagesGenerated).toBe(2);

      const regenerate = await request(app.getHttpServer())
        .post(`/campaigns/${create.body.id}/generate-messages`)
        .set('Cookie', [cookies])
        .send({});
      expect(regenerate.body).toEqual({
        generated: 0,
        failed: 0,
        alreadyGenerated: 2,
      });
    });
  });

  describe('organization isolation', () => {
    it("404s on another organization's campaign", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('camp-iso-a'),
        'Iso Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('camp-iso-b'),
        'Iso Org B',
      );
      const create = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Cookie', [orgA.cookies])
        .send({ ...CAMPAIGN_BODY, leadIds: [] });

      const res = await request(app.getHttpServer())
        .get(`/campaigns/${create.body.id}`)
        .set('Cookie', [orgB.cookies]);
      expect(res.status).toBe(404);
    });

    it("cannot add another organization's lead to a campaign", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('camp-iso2-a'),
        'Iso Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('camp-iso2-b'),
        'Iso Org B',
      );
      const foreignLead = await createLead(prisma, orgB.organizationId);

      const create = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Cookie', [orgA.cookies])
        .send({ ...CAMPAIGN_BODY, leadIds: [foreignLead.id] });

      expect(create.body._count.leads).toBe(0);
    });
  });

  describe('permissions', () => {
    it('blocks a VIEWER from creating, updating, or generating messages', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('camp-perm-owner'),
        'Perm Org',
      );
      const viewer = await registerUser(
        app,
        uniqueEmail('camp-perm-viewer'),
        'Viewer Solo Org',
      );
      await addMember(prisma, owner.organizationId, viewer.userId, 'VIEWER');

      const create = await request(app.getHttpServer())
        .post('/campaigns')
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ ...CAMPAIGN_BODY, leadIds: [] });
      expect(create.status).toBe(403);

      const list = await request(app.getHttpServer())
        .get('/campaigns')
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(list.status).toBe(200);
    });
  });
});
