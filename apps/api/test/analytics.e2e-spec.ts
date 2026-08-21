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

async function createLead(
  prisma: PrismaService,
  organizationId: string,
  overrides: Partial<{
    businessName: string;
    category: string | null;
    city: string | null;
    opportunityScore: number | null;
    leadStatus: string;
    createdAt: Date;
  }> = {},
) {
  return prisma.lead.create({
    data: {
      organizationId,
      businessName: overrides.businessName ?? 'Example Biz',
      category: overrides.category ?? null,
      city: overrides.city ?? null,
      opportunityScore: overrides.opportunityScore ?? null,
      leadStatus: (overrides.leadStatus as never) ?? 'SAVED',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

describe('Analytics & Dashboard (e2e)', () => {
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
    await request(app.getHttpServer()).get('/dashboard').expect(401);
    await request(app.getHttpServer()).get('/analytics').expect(401);
    await request(app.getHttpServer()).get('/leads/export').expect(401);
  });

  it('computes real, non-hardcoded metrics from the current leads', async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('dash-metrics'),
      'Dash Org',
    );
    await createLead(prisma, organizationId, {
      businessName: 'High Score A',
      opportunityScore: 90,
      leadStatus: 'SAVED',
      category: 'Restaurant',
      city: 'Dhaka',
    });
    await createLead(prisma, organizationId, {
      opportunityScore: 20,
      leadStatus: 'CONTACTED',
      category: 'Cafe',
      city: 'Dhaka',
    });
    await createLead(prisma, organizationId, { leadStatus: 'REPLIED' });
    await createLead(prisma, organizationId, { leadStatus: 'MEETING' });
    await createLead(prisma, organizationId, { leadStatus: 'WON' });
    await createLead(prisma, organizationId, { leadStatus: 'LOST' });

    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Cookie', [cookies]);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual({
      totalLeads: 6,
      highOpportunity: 1,
      saved: 1,
      contacted: 1,
      replies: 1,
      meetings: 1,
      won: 1,
      conversionRate: 1 / 6,
    });

    const statusChart = res.body.charts.leadStatus;
    expect(
      statusChart.find((s: { status: string }) => s.status === 'LOST').count,
    ).toBe(1);
    expect(
      statusChart.find((s: { status: string }) => s.status === 'WON').count,
    ).toBe(1);

    // Pipeline funnel is cumulative ("reached at least this stage") and excludes Lost from the stage bars.
    const funnel = res.body.charts.pipelineFunnel;
    expect(funnel.find((f: { label: string }) => f.label === 'New').count).toBe(
      5,
    );
    expect(funnel.find((f: { label: string }) => f.label === 'Won').count).toBe(
      1,
    );
    expect(
      funnel.find((f: { label: string }) => f.label === 'Lost').count,
    ).toBe(1);

    const categories = res.body.charts.topCategories;
    expect(categories).toEqual(
      expect.arrayContaining([
        { label: 'Restaurant', count: 1 },
        { label: 'Cafe', count: 1 },
      ]),
    );

    expect(res.body.charts.avgOpportunityScore).toBe(55);
    expect(res.body.recentLeads.length).toBeGreaterThan(0);
  });

  it("never mixes another organization's leads into metrics or charts", async () => {
    const orgA = await registerUser(
      app,
      uniqueEmail('dash-iso-a'),
      'Iso Org A',
    );
    const orgB = await registerUser(
      app,
      uniqueEmail('dash-iso-b'),
      'Iso Org B',
    );
    await createLead(prisma, orgA.organizationId, {
      businessName: 'Only in A',
    });

    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Cookie', [orgB.cookies]);
    expect(res.body.metrics.totalLeads).toBe(0);
  });

  it('surfaces the top opportunity leads with their key problem and recommended service', async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('dash-topopp'),
      'Dash Org',
    );
    const lead = await createLead(prisma, organizationId, {
      businessName: 'Needs a website',
      opportunityScore: 88,
    });
    await prisma.growthOpportunity.create({
      data: {
        leadId: lead.id,
        type: 'website',
        title: 'No website detected',
        evidence: 'No websiteUrl on file',
        recommendation: 'Build a website',
        impact: 'HIGH',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Cookie', [cookies]);

    expect(res.body.topOpportunities[0]).toMatchObject({
      businessName: 'Needs a website',
      opportunityScore: 88,
      keyProblem: 'No website detected',
      recommendedService: 'WEBSITE_DEVELOPMENT',
    });
  });

  describe('/analytics filters', () => {
    it('filters metrics by category, status, and score range', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('analytics-filters'),
        'Analytics Org',
      );
      await createLead(prisma, organizationId, {
        category: 'Restaurant',
        opportunityScore: 80,
        leadStatus: 'SAVED',
      });
      await createLead(prisma, organizationId, {
        category: 'Restaurant',
        opportunityScore: 10,
        leadStatus: 'WON',
      });
      await createLead(prisma, organizationId, {
        category: 'Salon',
        opportunityScore: 90,
        leadStatus: 'SAVED',
      });

      const res = await request(app.getHttpServer())
        .get('/analytics')
        .query({ category: 'restaurant', minScore: 50 })
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.body.metrics.totalLeads).toBe(1);
      expect(res.body.metrics.saved).toBe(1);
    });

    it('filters by explicit date range', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('analytics-dates'),
        'Analytics Org',
      );
      await createLead(prisma, organizationId, {
        businessName: 'Old lead',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      });
      await createLead(prisma, organizationId, { businessName: 'Recent lead' });

      const res = await request(app.getHttpServer())
        .get('/analytics')
        .query({ dateFrom: '2025-01-01' })
        .set('Cookie', [cookies]);

      expect(res.body.metrics.totalLeads).toBe(1);
    });

    it('rejects an invalid status filter', async () => {
      const { cookies } = await registerUser(
        app,
        uniqueEmail('analytics-bad'),
        'Analytics Org',
      );
      const res = await request(app.getHttpServer())
        .get('/analytics')
        .query({ status: 'NOT_REAL' })
        .set('Cookie', [cookies]);
      expect(res.status).toBe(400);
    });
  });

  describe('CSV export', () => {
    it('exports application-owned lead fields, excluding Google-sourced data', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('export-basic'),
        'Export Org',
      );
      await prisma.lead.create({
        data: {
          organizationId,
          businessName: 'Exportable Biz',
          category: 'Restaurant',
          leadStatus: 'SAVED',
          opportunityScore: 77,
          rating: 4.8,
          reviewCount: 250,
          googlePlaceId: 'places/should-not-appear',
          googleMapsUri: 'https://maps.google.com/should-not-appear',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/leads/export')
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');

      const text = res.text;
      expect(text).toContain('Exportable Biz');
      expect(text).toContain('77');
      expect(text).not.toContain('4.8');
      expect(text).not.toContain('250');
      expect(text).not.toContain('should-not-appear');
    });

    it('correctly escapes commas and quotes in exported fields', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('export-escape'),
        'Export Org',
      );
      await prisma.lead.create({
        data: {
          organizationId,
          businessName: 'Biz, "The Best" Ltd',
          leadStatus: 'SAVED',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/leads/export')
        .set('Cookie', [cookies]);

      expect(res.text).toContain('"Biz, ""The Best"" Ltd"');
    });

    it('respects the same filters as the leads list', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('export-filter'),
        'Export Org',
      );
      await prisma.lead.create({
        data: { organizationId, businessName: 'Won Lead', leadStatus: 'WON' },
      });
      await prisma.lead.create({
        data: {
          organizationId,
          businessName: 'Saved Lead',
          leadStatus: 'SAVED',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/leads/export')
        .query({ status: 'WON' })
        .set('Cookie', [cookies]);

      expect(res.text).toContain('Won Lead');
      expect(res.text).not.toContain('Saved Lead');
    });
  });
});
