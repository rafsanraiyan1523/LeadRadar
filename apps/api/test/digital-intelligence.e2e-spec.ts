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
    websiteUrl: string | null;
    rating: number | null;
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
      rating: overrides.rating ?? null,
      leadStatus: 'SAVED',
    },
  });
}

describe('Digital Intelligence Engine — lead audit (e2e)', () => {
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
      .get('/leads/does-not-exist/audit')
      .expect(401);
  });

  it("404s for another organization's lead", async () => {
    const orgA = await registerUser(app, uniqueEmail('di-iso-a'), 'DI Org A');
    const orgB = await registerUser(app, uniqueEmail('di-iso-b'), 'DI Org B');
    const lead = await createLead(prisma, orgA.organizationId);

    const res = await request(app.getHttpServer())
      .get(`/leads/${lead.id}/audit`)
      .set('Cookie', [orgB.cookies])
      .set('x-organization-id', orgB.organizationId);
    expect(res.status).toBe(404);
  });

  it('returns an honest "not yet audited" shape before any audit has run', async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('di-preaudit'),
      'DI Org',
    );
    const lead = await createLead(prisma, organizationId, { websiteUrl: null });

    const res = await request(app.getHttpServer())
      .get(`/leads/${lead.id}/audit`)
      .set('Cookie', [cookies]);

    expect(res.status).toBe(200);
    expect(res.body.website).toBeNull();
    expect(res.body.seo).toBeNull();
    expect(res.body.opportunity).toBeNull();
    expect(res.body.growthOpportunities).toEqual([]);
    expect(res.body.googleBusiness).toMatchObject({
      status: 'UNVERIFIED',
      score: null,
    });
    expect(res.body.conversion.contactability).toBeDefined();
  });

  it("surfaces a completed audit's scores, breakdowns, and findings", async () => {
    const { cookies, organizationId } = await registerUser(
      app,
      uniqueEmail('di-postaudit'),
      'DI Org',
    );
    const lead = await createLead(prisma, organizationId, { rating: 4.7 });

    await prisma.websiteAudit.create({
      data: {
        leadId: lead.id,
        websiteScore: 62,
        seoScore: 70,
        mobileScore: 60,
        conversionScore: 55,
        technicalScore: 80,
        accessibilityScore: 90,
        hasSsl: true,
        isMobileFriendly: true,
        techStack: ['WordPress'],
        issues: ['Missing meta description'],
        signals: {
          seo: {
            score: 70,
            breakdown: { hasTitle: true, hasMetaDescription: false },
          },
          conversion: {
            score: 55,
            breakdown: { hasContactCta: true, hasBookingCta: false },
          },
          performance: {
            homepageResponseTimeMs: 200,
            homepageSizeBytes: 50000,
          },
          brokenLinksChecked: 2,
          brokenLinksFound: 0,
        },
      },
    });

    await prisma.googleBusinessProfile.create({
      data: {
        leadId: lead.id,
        status: 'FOUND',
        score: 88,
        rating: 4.7,
        userRatingCount: 120,
        businessStatus: 'OPERATIONAL',
        displayName: 'Example Biz',
        fetchedAt: new Date(),
      },
    });

    await prisma.opportunityScore.create({
      data: {
        leadId: lead.id,
        score: 52,
        breakdown: {
          legitimacy: { total: 34 },
          digitalWeakness: { points: 18 },
        },
      },
    });

    await prisma.growthOpportunity.create({
      data: {
        leadId: lead.id,
        type: 'seo',
        title: 'Missing SEO metadata',
        evidence: 'no meta description',
        recommendation: 'Add a meta description.',
        impact: 'HIGH',
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/leads/${lead.id}/audit`)
      .set('Cookie', [cookies]);

    expect(res.status).toBe(200);
    expect(res.body.website).toMatchObject({
      websiteScore: 62,
      seoScore: 70,
      mobileScore: 60,
    });
    expect(res.body.seo).toMatchObject({ score: 70 });
    expect(res.body.conversion.score).toBe(55);
    expect(res.body.googleBusiness).toMatchObject({
      status: 'FOUND',
      score: 88,
    });
    expect(res.body.googleBusiness.signals).toMatchObject({
      rating: 4.7,
      userRatingCount: 120,
    });
    expect(res.body.opportunity).toMatchObject({ score: 52, level: 'MEDIUM' });
    expect(res.body.growthOpportunities).toEqual([
      expect.objectContaining({
        title: 'Missing SEO metadata',
        category: 'seo',
        severity: 'HIGH',
        evidence: 'no meta description',
        recommendation: 'Add a meta description.',
      }),
    ]);
  });
});
