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

/** Adds an existing (separately registered) user to an org with a given role — a direct-DB shortcut around the invite flow, since these tests are about CRM permissions, not invitations. */
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
  overrides: Partial<{
    businessName: string;
    category: string | null;
    city: string | null;
    websiteUrl: string | null;
    opportunityScore: number | null;
    leadStatus: string;
  }> = {},
) {
  return prisma.lead.create({
    data: {
      organizationId,
      businessName: overrides.businessName ?? 'Example Biz',
      category: overrides.category ?? 'Restaurant',
      city: overrides.city ?? 'Dhaka',
      websiteUrl: 'websiteUrl' in overrides ? overrides.websiteUrl! : null,
      opportunityScore: overrides.opportunityScore ?? 70,
      leadStatus: (overrides.leadStatus as never) ?? 'SAVED',
    },
  });
}

describe('CRM — pipeline, leads, saved, notes, tags, follow-ups (e2e)', () => {
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

  it('rejects unauthenticated requests across the CRM surface', async () => {
    await request(app.getHttpServer()).get('/pipeline').expect(401);
    await request(app.getHttpServer()).get('/leads').expect(401);
    await request(app.getHttpServer()).get('/saved-leads').expect(401);
    await request(app.getHttpServer())
      .patch('/leads/does-not-exist/status')
      .send({ status: 'CONTACTED' })
      .expect(401);
  });

  describe('status change', () => {
    it('persists a status change and logs an activity entry', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-status'),
        'Status Org',
      );
      const lead = await createLead(prisma, organizationId, {
        leadStatus: 'SAVED',
      });

      const res = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Cookie', [cookies])
        .send({ status: 'CONTACTED' });

      expect(res.status).toBe(200);
      expect(res.body.leadStatus).toBe('CONTACTED');

      const stored = await prisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
      });
      expect(stored.leadStatus).toBe('CONTACTED');

      const activities = await prisma.leadActivity.findMany({
        where: { leadId: lead.id },
      });
      expect(activities).toEqual([
        expect.objectContaining({
          type: 'lead.status_changed',
          metadata: { from: 'SAVED', to: 'CONTACTED' },
        }),
      ]);
    });

    it('rejects an invalid status value', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-status-bad'),
        'Status Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Cookie', [cookies])
        .send({ status: 'NOT_A_REAL_STATUS' });

      expect(res.status).toBe(400);
    });
  });

  describe('pipeline', () => {
    it('returns every lead in the org with card fields for the board to group', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-pipeline'),
        'Pipeline Org',
      );
      await createLead(prisma, organizationId, {
        leadStatus: 'SAVED',
        businessName: 'Biz A',
      });
      await createLead(prisma, organizationId, {
        leadStatus: 'WON',
        businessName: 'Biz B',
      });

      const res = await request(app.getHttpServer())
        .get('/pipeline')
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            businessName: 'Biz A',
            leadStatus: 'SAVED',
            tags: [],
            nextFollowUp: null,
          }),
          expect.objectContaining({ businessName: 'Biz B', leadStatus: 'WON' }),
        ]),
      );
    });

    it("never returns another organization's leads", async () => {
      const orgA = await registerUser(app, uniqueEmail('crm-iso-a'), 'Org A');
      const orgB = await registerUser(app, uniqueEmail('crm-iso-b'), 'Org B');
      await createLead(prisma, orgA.organizationId, {
        businessName: 'Only in A',
      });

      const res = await request(app.getHttpServer())
        .get('/pipeline')
        .set('Cookie', [orgB.cookies]);

      expect(res.body.items).toEqual([]);
    });
  });

  describe('leads list filters', () => {
    it('filters by status, category, and minimum score', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-filters'),
        'Filters Org',
      );
      await createLead(prisma, organizationId, {
        businessName: 'High Score Restaurant',
        category: 'Restaurant',
        opportunityScore: 90,
        leadStatus: 'SAVED',
      });
      await createLead(prisma, organizationId, {
        businessName: 'Low Score Cafe',
        category: 'Cafe',
        opportunityScore: 10,
        leadStatus: 'WON',
      });

      const res = await request(app.getHttpServer())
        .get('/leads')
        .query({ category: 'restaurant', minScore: 50, status: 'SAVED' })
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].businessName).toBe('High Score Restaurant');
    });
  });

  describe('saved leads (bookmarks)', () => {
    it("saves and unsaves a lead, reflected only in that user's saved list", async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-save'),
        'Save Org',
      );
      const lead = await createLead(prisma, organizationId, {
        businessName: 'Bookmark Me',
      });

      const emptyList = await request(app.getHttpServer())
        .get('/saved-leads')
        .set('Cookie', [cookies]);
      expect(emptyList.body.items).toEqual([]);

      const save = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/save`)
        .set('Cookie', [cookies]);
      expect(save.status).toBe(201);
      expect(save.body).toEqual({ saved: true });

      const afterSave = await request(app.getHttpServer())
        .get('/saved-leads')
        .set('Cookie', [cookies]);
      expect(afterSave.body.items).toHaveLength(1);
      expect(afterSave.body.items[0].businessName).toBe('Bookmark Me');

      const unsave = await request(app.getHttpServer())
        .delete(`/leads/${lead.id}/save`)
        .set('Cookie', [cookies]);
      expect(unsave.status).toBe(200);
      expect(unsave.body).toEqual({ saved: false });

      const afterUnsave = await request(app.getHttpServer())
        .get('/saved-leads')
        .set('Cookie', [cookies]);
      expect(afterUnsave.body.items).toEqual([]);
    });
  });

  describe('notes', () => {
    it('adds a private note and logs it on the activity timeline', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-notes'),
        'Notes Org',
      );
      const lead = await createLead(prisma, organizationId);

      const add = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/notes`)
        .set('Cookie', [cookies])
        .send({ text: 'Owner replied. Asked for website pricing.' });
      expect(add.status).toBe(201);

      const list = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/notes`)
        .set('Cookie', [cookies]);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({
        type: 'lead.note_added',
        metadata: { text: 'Owner replied. Asked for website pricing.' },
      });

      const activities = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/activities`)
        .set('Cookie', [cookies]);
      expect(activities.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'lead.note_added' }),
        ]),
      );
    });

    it('rejects an empty note', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-notes-bad'),
        'Notes Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/notes`)
        .set('Cookie', [cookies])
        .send({ text: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('tags', () => {
    it('attaches a preset tag and a custom tag, lists them, then detaches one', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-tags'),
        'Tags Org',
      );
      const lead = await createLead(prisma, organizationId);

      const hot = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies])
        .send({ name: 'Hot' });
      expect(hot.status).toBe(201);

      const custom = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies])
        .send({ name: 'Referral Partner' });
      expect(custom.status).toBe(201);

      const leadTags = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies]);
      expect(leadTags.body.map((t: { name: string }) => t.name).sort()).toEqual(
        ['Hot', 'Referral Partner'],
      );

      const orgTags = await request(app.getHttpServer())
        .get('/tags')
        .set('Cookie', [cookies]);
      expect(orgTags.body).toHaveLength(2);

      const detach = await request(app.getHttpServer())
        .delete(`/leads/${lead.id}/tags/${hot.body.id}`)
        .set('Cookie', [cookies]);
      expect(detach.status).toBe(200);

      const afterDetach = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies]);
      expect(afterDetach.body).toHaveLength(1);
      expect(afterDetach.body[0].name).toBe('Referral Partner');
    });

    it('re-attaching the same tag name is idempotent (no duplicate rows)', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-tags-dup'),
        'Tags Org',
      );
      const lead = await createLead(prisma, organizationId);

      await request(app.getHttpServer())
        .post(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies])
        .send({ name: 'Dhaka' });
      await request(app.getHttpServer())
        .post(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies])
        .send({ name: 'Dhaka' });

      const leadTags = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/tags`)
        .set('Cookie', [cookies]);
      expect(leadTags.body).toHaveLength(1);
    });
  });

  describe('follow-ups', () => {
    it('creates a follow-up, logs activity, creates a notification, then completes it', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-followup'),
        'Follow-up Org',
      );
      const lead = await createLead(prisma, organizationId);
      const dueAt = new Date(Date.now() + 86_400_000).toISOString();

      const create = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/follow-ups`)
        .set('Cookie', [cookies])
        .send({ dueAt, note: 'Call about the proposal' });
      expect(create.status).toBe(201);
      expect(create.body).toMatchObject({
        status: 'PENDING',
        note: 'Call about the proposal',
      });

      const list = await request(app.getHttpServer())
        .get(`/leads/${lead.id}/follow-ups`)
        .set('Cookie', [cookies]);
      expect(list.body).toHaveLength(1);

      const activities = await prisma.leadActivity.findMany({
        where: { leadId: lead.id, type: 'lead.follow_up_created' },
      });
      expect(activities).toHaveLength(1);

      const notifications = await prisma.notification.findMany({
        where: { organizationId, type: 'follow_up.created' },
      });
      expect(notifications).toHaveLength(1);

      const complete = await request(app.getHttpServer())
        .patch(`/follow-ups/${create.body.id}/complete`)
        .set('Cookie', [cookies]);
      expect(complete.status).toBe(200);
      expect(complete.body.status).toBe('DONE');
    });

    it('cancels a follow-up', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-followup-cancel'),
        'Follow-up Org',
      );
      const lead = await createLead(prisma, organizationId);
      const dueAt = new Date(Date.now() + 86_400_000).toISOString();

      const create = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/follow-ups`)
        .set('Cookie', [cookies])
        .send({ dueAt });

      const cancel = await request(app.getHttpServer())
        .patch(`/follow-ups/${create.body.id}/cancel`)
        .set('Cookie', [cookies]);
      expect(cancel.status).toBe(200);
      expect(cancel.body.status).toBe('CANCELLED');
    });

    it('rejects a follow-up with an invalid date', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-followup-bad'),
        'Follow-up Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/follow-ups`)
        .set('Cookie', [cookies])
        .send({ dueAt: 'not-a-date' });
      expect(res.status).toBe(400);
    });
  });

  describe('client-loggable activity', () => {
    it('logs an allowed activity type', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-activity'),
        'Activity Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/activity`)
        .set('Cookie', [cookies])
        .send({ type: 'lead.message_copied' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('lead.message_copied');
    });

    it('rejects an arbitrary, non-whitelisted activity type', async () => {
      const { cookies, organizationId } = await registerUser(
        app,
        uniqueEmail('crm-activity-bad'),
        'Activity Org',
      );
      const lead = await createLead(prisma, organizationId);

      const res = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/activity`)
        .set('Cookie', [cookies])
        .send({ type: 'lead.status_changed' });
      expect(res.status).toBe(400);
    });
  });

  describe('organization isolation', () => {
    it("404s on another organization's lead for status, notes, tags, and follow-ups", async () => {
      const orgA = await registerUser(
        app,
        uniqueEmail('crm-iso2-a'),
        'Iso Org A',
      );
      const orgB = await registerUser(
        app,
        uniqueEmail('crm-iso2-b'),
        'Iso Org B',
      );
      const lead = await createLead(prisma, orgA.organizationId);

      const status = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Cookie', [orgB.cookies])
        .send({ status: 'CONTACTED' });
      expect(status.status).toBe(404);

      const note = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/notes`)
        .set('Cookie', [orgB.cookies])
        .send({ text: 'should not be allowed' });
      expect(note.status).toBe(404);

      const tag = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/tags`)
        .set('Cookie', [orgB.cookies])
        .send({ name: 'Hot' });
      expect(tag.status).toBe(404);

      const followUp = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/follow-ups`)
        .set('Cookie', [orgB.cookies])
        .send({ dueAt: new Date(Date.now() + 86_400_000).toISOString() });
      expect(followUp.status).toBe(404);
    });
  });

  describe('permissions', () => {
    it('allows a VIEWER to read the pipeline and leads list but blocks every write action', async () => {
      const owner = await registerUser(
        app,
        uniqueEmail('crm-perm-owner'),
        'Perm Org',
      );
      const viewer = await registerUser(
        app,
        uniqueEmail('crm-perm-viewer'),
        'Viewer Solo Org',
      );
      await addMember(prisma, owner.organizationId, viewer.userId, 'VIEWER');
      const lead = await createLead(prisma, owner.organizationId);

      const pipeline = await request(app.getHttpServer())
        .get('/pipeline')
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(pipeline.status).toBe(200);

      const leadsList = await request(app.getHttpServer())
        .get('/leads')
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(leadsList.status).toBe(200);

      const statusChange = await request(app.getHttpServer())
        .patch(`/leads/${lead.id}/status`)
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ status: 'CONTACTED' });
      expect(statusChange.status).toBe(403);

      const note = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/notes`)
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ text: 'nope' });
      expect(note.status).toBe(403);

      const tag = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/tags`)
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ name: 'Hot' });
      expect(tag.status).toBe(403);

      const followUp = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/follow-ups`)
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId)
        .send({ dueAt: new Date(Date.now() + 86_400_000).toISOString() });
      expect(followUp.status).toBe(403);

      const save = await request(app.getHttpServer())
        .post(`/leads/${lead.id}/save`)
        .set('Cookie', [viewer.cookies])
        .set('x-organization-id', owner.organizationId);
      expect(save.status).toBe(403);

      // The lead status must be unchanged after every blocked write above.
      const stored = await prisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
      });
      expect(stored.leadStatus).toBe('SAVED');
    });
  });
});
