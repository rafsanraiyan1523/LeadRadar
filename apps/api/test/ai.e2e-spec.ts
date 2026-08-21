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
    organizationId: me.body.memberships[0].organizationId as string,
  };
}

async function createLead(prisma: PrismaService, organizationId: string) {
  return prisma.lead.create({
    data: {
      organizationId,
      businessName: 'Example Cafe',
      category: 'Cafe',
      city: 'Dhaka',
      country: 'Bangladesh',
      rating: 4.7,
      reviewCount: 150,
      websiteUrl: null,
      phone: '+8801711111111',
      leadStatus: 'SAVED',
    },
  });
}

describe('AI intelligence & outreach (e2e)', () => {
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

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .get('/leads/does-not-exist/insight')
      .expect(401);
  });

  it("404s for another organization's lead", async () => {
    const orgA = await registerUser(app, uniqueEmail('ai-iso-a'), 'AI Org A');
    const orgB = await registerUser(app, uniqueEmail('ai-iso-b'), 'AI Org B');
    const lead = await createLead(prisma, orgA.organizationId);

    const res = await request(app.getHttpServer())
      .post(`/leads/${lead.id}/insight/generate`)
      .set('Cookie', [orgB.cookies])
      .set('x-organization-id', orgB.organizationId);
    expect(res.status).toBe(404);
  });

  describe('AI Insight (lead summary + growth analysis + recommended services)', () => {
    it('returns null before any generation, then a real, cached-per-lead insight after', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-insight'),
        'AI Org',
      );
      const lead = await createLead(prisma, organizationId);
      // Growth opportunities are read from already-detected findings, never
      // invented at generation time — seed one the way the enrichment
      // pipeline would, since no worker runs in this e2e suite.
      await prisma.growthOpportunity.create({
        data: {
          leadId: lead.id,
          type: 'website',
          title: 'No website detected',
          evidence: 'No website URL is on file for this business.',
          recommendation: 'Build a professional website.',
          impact: 'HIGH',
        },
      });

      const before = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/insight`)
        .set('Cookie', [cookies]);
      expect(before.status).toBe(200);
      expect(before.body.insight).toBeNull();

      const generated = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/insight/generate`)
        .set('Cookie', [cookies]);
      expect(generated.status).toBe(201);
      expect(generated.body.summary).toEqual(expect.any(String));
      expect(generated.body.growthAnalysis).toEqual(expect.any(String));
      expect(generated.body.providerMode).toBe('MOCK');
      expect(Array.isArray(generated.body.recommendedServices)).toBe(true);
      // No website on file for this lead -> website development is always warranted.
      expect(generated.body.recommendedServices).toContain(
        'WEBSITE_DEVELOPMENT',
      );

      const after = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/insight`)
        .set('Cookie', [cookies]);
      expect(after.body.insight.summary).toBe(generated.body.summary);
    });

    it('serves the cache (logs a cached usage event, does not recompute) on a repeat request with unchanged data', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-cache'),
        'AI Org',
      );
      const lead = await createLead(prisma, organizationId);

      await request(app.getHttpServer())
        .post(`/leads/${lead.id}/insight/generate`)
        .set('Cookie', [cookies]);
      await request(app.getHttpServer())
        .post(`/leads/${lead.id}/insight/generate`)
        .set('Cookie', [cookies]);

      const events = await prisma.aIUsageEvent.findMany({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'asc' },
      });
      // 2 features x 2 requests = 4 events; the second request's pair should be cached.
      expect(events).toHaveLength(4);
      expect(events[2].cached).toBe(true);
      expect(events[3].cached).toBe(true);

      const insightRows = await prisma.aIInsight.findMany({
        where: { leadId: lead.id },
      });
      expect(insightRows).toHaveLength(1); // cached, current-state row — never a growing history
    });
  });

  describe('Outreach generation', () => {
    it('rejects an invalid channel/tone/language', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-outreach-bad'),
        'AI Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({
          channel: 'CARRIER_PIGEON',
          tone: 'PROFESSIONAL',
          language: 'ENGLISH',
        });
      expect(res.status).toBe(400);
    });

    it('generates a real outreach message, always as a new row', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-outreach-ok'),
        'AI Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({ channel: 'EMAIL', tone: 'PROFESSIONAL', language: 'ENGLISH' });

      expect(res.status).toBe(201);
      expect(res.body.kind).toBe('OUTREACH');
      expect(res.body.channel).toBe('EMAIL');
      expect(res.body.subject).toEqual(expect.any(String));
      expect(res.body.body).toEqual(expect.any(String));
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.providerMode).toBe('MOCK');

      const list = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/outreach`)
        .set('Cookie', [cookies]);
      expect(list.body).toHaveLength(1);

      // Regenerating creates a second row rather than overwriting the first.
      await request(app.getHttpServer())
        .post(`/leads/${lead.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({ channel: 'EMAIL', tone: 'FRIENDLY', language: 'ENGLISH' });
      const listAfter = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/outreach`)
        .set('Cookie', [cookies]);
      expect(listAfter.body).toHaveLength(2);
    });

    it('generates messages in Bangla and Banglish', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-outreach-lang'),
        'AI Org',
      );
      const lead = await createLead(prisma, organizationId);

      const bangla = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({ channel: 'WHATSAPP', tone: 'FRIENDLY', language: 'BANGLA' });
      expect(bangla.status).toBe(201);
      expect(bangla.body.body).toMatch(/[ঀ-৿]/);

      const banglish = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({ channel: 'WHATSAPP', tone: 'FRIENDLY', language: 'BANGLISH' });
      expect(banglish.status).toBe(201);
      expect(banglish.body.body).not.toMatch(/[ঀ-৿]/);
    });

    it('generates a follow-up only against a real prior message on the same lead', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-followup'),
        'AI Org',
      );
      const leadA = await createLead(prisma, organizationId);
      const leadB = await createLead(prisma, organizationId);

      const first = await request(app.getHttpServer())
        .post(`/leads/${leadA.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({ channel: 'EMAIL', tone: 'PROFESSIONAL', language: 'ENGLISH' });

      const wrongLead = await request(app.getHttpServer())
        .post(`/leads/${leadB.id}/outreach/follow-up`)
        .set('Cookie', [cookies])
        .send({
          channel: 'EMAIL',
          tone: 'PROFESSIONAL',
          language: 'ENGLISH',
          previousMessageId: first.body.id,
        });
      expect(wrongLead.status).toBe(404);

      const followUp = await request(app.getHttpServer())
        .post(`/leads/${leadA.id}/outreach/follow-up`)
        .set('Cookie', [cookies])
        .send({
          channel: 'EMAIL',
          tone: 'PROFESSIONAL',
          language: 'ENGLISH',
          previousMessageId: first.body.id,
        });
      expect(followUp.status).toBe(201);
      expect(followUp.body.kind).toBe('FOLLOW_UP');
    });

    it('lets the user edit and mark a message sent — never automatically', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('ai-edit'),
        'AI Org',
      );
      const lead = await createLead(prisma, organizationId);

      const generated = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/outreach/generate`)
        .set('Cookie', [cookies])
        .send({ channel: 'SMS', tone: 'SHORT', language: 'ENGLISH' });

      const edited = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/outreach/${generated.body.id}`)
        .set('Cookie', [cookies])
        .send({ body: 'A manually edited message.' });
      expect(edited.body.body).toBe('A manually edited message.');
      expect(edited.body.status).toBe('DRAFT');

      const sent = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/outreach/${generated.body.id}`)
        .set('Cookie', [cookies])
        .send({ status: 'SENT' });
      expect(sent.body.status).toBe('SENT');
      expect(sent.body.sentAt).not.toBeNull();
    });
  });
});
