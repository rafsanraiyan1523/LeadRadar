import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, extractCookies, type TestApp } from './setup/test-app';
import type { FakeQueue } from './setup/fake-queue';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { LeadEnrichmentJobData } from '@lead-radar/types';

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

async function createLead(
  prisma: PrismaService,
  organizationId: string,
  overrides: Partial<{
    businessName: string;
    websiteUrl: string | null;
    phone: string | null;
    email: string | null;
  }> = {},
) {
  return prisma.lead.create({
    data: {
      organizationId,
      businessName: overrides.businessName ?? 'Example Biz',
      websiteUrl:
        'websiteUrl' in overrides
          ? overrides.websiteUrl!
          : 'https://examplebiz.test/',
      phone: overrides.phone ?? null,
      email: overrides.email ?? null,
      leadStatus: 'SAVED',
    },
  });
}

describe('Leads / enrichment (e2e)', () => {
  let app: INestApplication<App>;
  let queue: FakeQueue<LeadEnrichmentJobData>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp: TestApp = await createTestApp();
    app = testApp.app;
    queue = testApp.enrichmentQueue;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('enrich trigger', () => {
    it('rejects an unauthenticated enrich request', async () => {
      await request(app.getHttpServer())
        .post('/leads/does-not-exist/enrich')
        .expect(401);
    });

    it('404s for a lead that does not exist', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('enrich-404'),
        'Enrich Org',
      );
      const res = await request(app.getHttpServer())
        .post('/leads/00000000-0000-0000-0000-000000000000/enrich')
        .set('Cookie', [cookies]);
      expect(res.status).toBe(404);
    });

    it('enqueues a lead-enrichment job and marks the lead PENDING', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('enrich-ok'),
        'Enrich Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/enrich`)
        .set('Cookie', [cookies]);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        leadId: lead.id,
        status: 'PENDING',
        alreadyInProgress: false,
      });
      expect(queue.jobs.some((j) => j.data.leadId === lead.id)).toBe(true);

      const updated = await prisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
      });
      expect(updated.enrichmentStatus).toBe('PENDING');
    });

    it('does not re-enqueue when enrichment is already running', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('enrich-dup'),
        'Enrich Org',
      );
      const lead = await createLead(prisma, organizationId);
      await prisma.lead.update({
        where: { id: lead.id },
        data: { enrichmentStatus: 'RUNNING' },
      });

      const jobsBefore = queue.jobs.length;
      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/enrich`)
        .set('Cookie', [cookies]);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        leadId: lead.id,
        alreadyInProgress: true,
      });
      expect(queue.jobs.length).toBe(jobsBefore);
    });

    it('marks the lead FAILED and surfaces an error when enqueueing fails', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('enrich-qfail'),
        'Enrich Org',
      );
      const lead = await createLead(prisma, organizationId);

      queue.shouldFailToEnqueue = true;
      try {
        const res = await request(app.getHttpServer())
          .post(`/leads/${lead.id}/enrich`)
          .set('Cookie', [cookies]);
        expect(res.status).toBe(500);
      } finally {
        queue.shouldFailToEnqueue = false;
      }

      const failed = await prisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
      });
      expect(failed.enrichmentStatus).toBe('FAILED');
      expect(failed.enrichmentError).toBe('Failed to queue enrichment job');
    });
  });

  describe('organization isolation', () => {
    it("cannot enrich or read another organization's lead", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('iso-enrich-a'),
        'Iso Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('iso-enrich-b'),
        'Iso Org B',
      );
      const lead = await createLead(prisma, orgA.organizationId);

      const enrichRes = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/enrich`)
        .set('Cookie', [orgB.cookies])
        .set('x-organization-id', orgB.organizationId);
      expect(enrichRes.status).toBe(404);

      const getRes = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/enrichment`)
        .set('Cookie', [orgB.cookies])
        .set('x-organization-id', orgB.organizationId);
      expect(getRes.status).toBe(404);
    });
  });

  describe('enrichment response shape', () => {
    it('returns contactability score and enrichment status for a lead with no signals yet', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('enrich-shape'),
        'Enrich Org',
      );
      const lead = await createLead(prisma, organizationId, {
        websiteUrl: null,
      });

      const res = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/enrichment`)
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        leadId: lead.id,
        businessName: 'Example Biz',
        enrichment: { status: 'NOT_STARTED', progress: 0 },
        contactability: { score: 0 },
      });
      expect(res.body.contacts).toEqual([]);
      expect(res.body.socialProfiles).toEqual([]);
    });

    it('reflects known phone/email/website signals in the contactability score', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('enrich-score'),
        'Enrich Org',
      );
      const lead = await createLead(prisma, organizationId, {
        phone: '+8801711111111',
        email: 'hello@examplebiz.test',
        websiteUrl: 'https://examplebiz.test/',
      });

      const res = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/enrichment`)
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.body.contactability.score).toBe(55); // phone(20) + email(20) + website(15)
      expect(res.body.contactability.breakdown).toMatchObject({
        hasPhone: true,
        hasEmail: true,
        hasWebsite: true,
        hasFacebook: false,
      });
    });
  });
});
