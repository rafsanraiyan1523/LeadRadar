import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, extractCookies, type TestApp } from './setup/test-app';
import type { FakeQueue } from './setup/fake-queue';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { LeadDiscoveryJobData } from '@lead-radar/types';

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

describe('Lead discovery (e2e)', () => {
  let app: INestApplication<App>;
  let queue: FakeQueue<LeadDiscoveryJobData>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const testApp: TestApp = await createTestApp();
    app = testApp.app;
    queue = testApp.queue;
    prisma = testApp.prisma;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('search validation', () => {
    it('rejects a search with no business type', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('val-query'),
        'Validation Org',
      );
      const res = await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [cookies])
        .send({ location: 'Banani, Dhaka' });
      expect(res.status).toBe(400);
    });

    it('rejects a search with no location', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('val-location'),
        'Validation Org',
      );
      const res = await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [cookies])
        .send({ query: 'Cafe' });
      expect(res.status).toBe(400);
    });

    it('rejects a radius outside the allowed range', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('val-radius'),
        'Validation Org',
      );
      const res = await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [cookies])
        .send({
          query: 'Cafe',
          location: 'Banani, Dhaka',
          radiusMeters: 999_999,
        });
      expect(res.status).toBe(400);
    });

    it('rejects an unauthenticated search request', async () => {
      await request(app.getHttpServer())
        .post('/searches')
        .send({ query: 'Cafe', location: 'Banani, Dhaka' })
        .expect(401);
    });

    it('accepts a valid search and creates a PENDING search enqueued on the lead-discovery queue', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('val-ok'),
        'Validation Org',
      );
      const res = await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [cookies])
        .send({ query: 'Cafe', location: 'Banani, Dhaka', maxResults: 10 });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        query: 'Cafe',
        location: 'Banani, Dhaka',
        providerMode: 'MOCK',
      });
      expect(queue.jobs.some((j) => j.data.searchId === res.body.id)).toBe(
        true,
      );
    });
  });

  describe('organization isolation', () => {
    it("cannot read another organization's search", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('iso-search-a'),
        'Search Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('iso-search-b'),
        'Search Org B',
      );

      const createRes = await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [orgA.cookies])
        .send({ query: 'Restaurant', location: 'Gulshan, Dhaka' });
      const searchId = createRes.body.id as string;

      const crossOrgRead = await request(app.getHttpServer())
        .get(`/searches/${searchId}`)
        .set('Cookie', [orgB.cookies])
        .set('x-organization-id', orgB.organizationId);
      expect(crossOrgRead.status).toBe(404);

      const crossOrgResults = await request(app.getHttpServer())
        .get(`/searches/${searchId}/results`)
        .set('Cookie', [orgB.cookies])
        .set('x-organization-id', orgB.organizationId);
      expect(crossOrgResults.status).toBe(404);
    });

    it("does not list another organization's searches in the history", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('iso-hist-a'),
        'History Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('iso-hist-b'),
        'History Org B',
      );

      await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [orgA.cookies])
        .send({ query: 'Hotel', location: 'Uttara, Dhaka' });

      const listRes = await request(app.getHttpServer())
        .get('/searches')
        .set('Cookie', [orgB.cookies]);

      expect(listRes.status).toBe(200);
      expect(listRes.body.items).toHaveLength(0);
    });

    it("cannot bulk-save another organization's search results", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('iso-save-a'),
        'Save Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('iso-save-b'),
        'Save Org B',
      );

      const search = await prisma.search.create({
        data: {
          organizationId: orgA.organizationId,
          userId: (
            await prisma.organizationMember.findFirstOrThrow({
              where: { organizationId: orgA.organizationId },
            })
          ).userId,
          query: 'Gym',
          location: 'Dhanmondi, Dhaka',
          providerMode: 'MOCK',
          status: 'COMPLETED',
        },
      });
      const result = await prisma.searchResult.create({
        data: { searchId: search.id, businessName: 'Iron Gym', rawData: {} },
      });

      const res = await request(app.getHttpServer())
        .post('/search-results/bulk-save')
        .set('Cookie', [orgB.cookies])
        .send({ searchResultIds: [result.id] });

      expect(res.status).toBe(400);
    });
  });

  describe('queue failure', () => {
    it('marks the search FAILED and surfaces an error when enqueueing fails', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('queue-fail'),
        'Queue Fail Org',
      );

      queue.shouldFailToEnqueue = true;
      try {
        const res = await request(app.getHttpServer())
          .post('/searches')
          .set('Cookie', [cookies])
          .send({ query: 'Cafe', location: 'Banani, Dhaka' });
        expect(res.status).toBe(500);
      } finally {
        queue.shouldFailToEnqueue = false;
      }

      const failed = await prisma.search.findFirst({
        where: { query: 'Cafe', status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(failed).not.toBeNull();
      expect(failed?.errorMessage).toBe('Failed to queue search job');
    });

    it('recovers on the next request once the queue is healthy again', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('queue-recover'),
        'Queue Recover Org',
      );

      const res = await request(app.getHttpServer())
        .post('/searches')
        .set('Cookie', [cookies])
        .send({ query: 'Cafe', location: 'Banani, Dhaka' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
    });
  });

  describe('bulk save', () => {
    it('promotes selected search results into leads', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('bulk-save'),
        'Bulk Save Org',
      );
      const userId = (
        await prisma.organizationMember.findFirstOrThrow({
          where: { organizationId },
        })
      ).userId;

      const search = await prisma.search.create({
        data: {
          organizationId,
          userId,
          query: 'Salon',
          location: 'Banani, Dhaka',
          providerMode: 'MOCK',
          status: 'COMPLETED',
        },
      });
      const result = await prisma.searchResult.create({
        data: {
          searchId: search.id,
          businessName: 'Glow Beauty Salon',
          category: 'Beauty Salon',
          rating: 4.5,
          reviewCount: 80,
          hasWebsite: false,
          rawData: {},
        },
      });

      const res = await request(app.getHttpServer())
        .post('/search-results/bulk-save')
        .set('Cookie', [cookies])
        .send({ searchResultIds: [result.id] });

      expect(res.status).toBe(201);
      expect(res.body.leadIds).toHaveLength(1);

      const lead = await prisma.lead.findUnique({
        where: { id: res.body.leadIds[0] },
      });
      expect(lead).toMatchObject({
        businessName: 'Glow Beauty Salon',
        leadStatus: 'SAVED',
        organizationId,
      });
    });
  });
});
