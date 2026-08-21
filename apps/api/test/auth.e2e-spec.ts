import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, extractCookies, type TestApp } from './setup/test-app';
import type { MemoryMailProvider } from './setup/memory-mail.provider';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const PASSWORD = 'correct-horse-1';

async function registerUser(app: INestApplication<App>, email: string) {
  const res = await request(app.getHttpServer()).post('/auth/register').send({
    email,
    password: PASSWORD,
    name: 'Ada Lovelace',
    organizationName: 'Analytical Engines Ltd',
  });
  return { res, cookies: extractCookies(res.headers['set-cookie']) };
}

describe('Auth (e2e)', () => {
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

  describe('registration', () => {
    it('creates a user + organization and sets session cookies', async () => {
      const email = uniqueEmail('register');
      const { res, cookies } = await registerUser(app, email);

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({ email, name: 'Ada Lovelace' });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(cookies).toContain('lr_access_token=');
      expect(cookies).toContain('lr_refresh_token=');
    });

    it('rejects a duplicate email', async () => {
      const email = uniqueEmail('dup');
      await registerUser(app, email);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: PASSWORD,
          name: 'Someone Else',
          organizationName: 'Another Org',
        });

      expect(res.status).toBe(409);
    });

    it('rejects a weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: uniqueEmail('weak'),
          password: 'short',
          name: 'Ada',
          organizationName: 'Org',
        });

      expect(res.status).toBe(400);
    });

    it('sends a verification email containing a usable token', async () => {
      const email = uniqueEmail('verify');
      await registerUser(app, email);

      const message = mail.latestFor(email);
      expect(message?.subject).toMatch(/verify/i);
      expect(() => mail.extractToken(message!)).not.toThrow();
    });
  });

  describe('login', () => {
    it('logs in with correct credentials', async () => {
      const email = uniqueEmail('login-ok');
      await registerUser(app, email);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('nobody'), password: PASSWORD });

      expect(res.status).toBe(401);
    });

    it('rejects an incorrect password with the same message as an unknown email', async () => {
      const email = uniqueEmail('login-bad-pw');
      await registerUser(app, email);

      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'totally-wrong-1' });
      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('nobody2'), password: PASSWORD });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.message).toEqual(unknownEmail.body.message);
    });
  });

  describe('protected routes', () => {
    it('rejects /auth/me with no session', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('rejects /auth/me with a garbage cookie', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', 'lr_access_token=not-a-real-jwt')
        .expect(401);
    });

    it('returns the current user when authenticated', async () => {
      const email = uniqueEmail('me');
      const { cookies } = await registerUser(app, email);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [cookies]);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
      expect(res.body.memberships).toHaveLength(1);
      expect(res.body.memberships[0].role).toBe('OWNER');
    });
  });

  describe('logout', () => {
    it('clears the session so /auth/me subsequently fails', async () => {
      const email = uniqueEmail('logout');
      const { cookies } = await registerUser(app, email);

      const logoutRes = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', [cookies]);
      expect(logoutRes.status).toBe(200);

      const clearedCookies = extractCookies(logoutRes.headers['set-cookie']);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [clearedCookies])
        .expect(401);
    });
  });

  describe('session refresh', () => {
    it('rotates the refresh token and issues a new access token', async () => {
      const email = uniqueEmail('refresh');
      const { cookies } = await registerUser(app, email);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [cookies]);
      expect(refreshRes.status).toBe(200);

      const newCookies = extractCookies(refreshRes.headers['set-cookie']);
      expect(newCookies).not.toEqual(cookies);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [newCookies])
        .expect(200);
    });

    it('detects reuse of an already-rotated refresh token and revokes the session', async () => {
      const email = uniqueEmail('reuse');
      const { cookies } = await registerUser(app, email);

      // First refresh rotates the token — this is now valid.
      const first = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [cookies]);
      expect(first.status).toBe(200);

      // Replaying the original (now-rotated) refresh token must fail...
      const replay = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [cookies]);
      expect(replay.status).toBe(401);

      // ...and as a consequence, the token issued by the first refresh is
      // also revoked (reuse detection kills the whole session family).
      const newCookies = extractCookies(first.headers['set-cookie']);
      const afterReuse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [newCookies]);
      expect(afterReuse.status).toBe(401);
    });

    it('rejects refresh with no cookie at all', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });
  });

  describe('change password', () => {
    it('requires the correct current password', async () => {
      const email = uniqueEmail('change-pw');
      const { cookies } = await registerUser(app, email);

      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Cookie', [cookies])
        .send({
          currentPassword: 'wrong-current-1',
          newPassword: 'new-password-1',
        });

      expect(res.status).toBe(401);
    });

    it('changes the password and the new one works on next login', async () => {
      const email = uniqueEmail('change-pw-ok');
      const { cookies } = await registerUser(app, email);

      const changeRes = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Cookie', [cookies])
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pw-1' });
      expect(changeRes.status).toBe(200);

      const loginOld = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: PASSWORD });
      expect(loginOld.status).toBe(401);

      const loginNew = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'brand-new-pw-1' });
      expect(loginNew.status).toBe(200);
    });
  });

  describe('forgot / reset password', () => {
    it('always responds 200 whether or not the email exists (no enumeration)', async () => {
      const knownEmail = uniqueEmail('forgot-known');
      await registerUser(app, knownEmail);

      const known = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: knownEmail });
      const unknown = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: uniqueEmail('forgot-unknown') });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
    });

    it('resets the password with a valid token and revokes existing sessions', async () => {
      const email = uniqueEmail('reset-ok');
      const { cookies } = await registerUser(app, email);
      mail.clear();

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });
      const message = mail.latestFor(email);
      const token = mail.extractToken(message!);

      const resetRes = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'reset-password-1' });
      expect(resetRes.status).toBe(200);

      // The refresh session from before the reset is revoked, so it can no
      // longer be used to mint new access tokens. (The short-lived access
      // token already issued keeps working until it naturally expires —
      // that's inherent to stateless JWTs, not something session revocation
      // can retroactively undo without a DB check on every request.)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [cookies])
        .expect(401);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'reset-password-1' });
      expect(loginRes.status).toBe(200);
    });

    it('rejects an already-used reset token', async () => {
      const email = uniqueEmail('reset-reuse');
      await registerUser(app, email);
      mail.clear();

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email });
      const token = mail.extractToken(mail.latestFor(email)!);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'first-reset-1' })
        .expect(200);

      const secondAttempt = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'second-reset-1' });
      expect(secondAttempt.status).toBe(401);
    });
  });

  describe('email verification', () => {
    it('confirms with a valid token and rejects reuse', async () => {
      const email = uniqueEmail('verify-confirm');
      await registerUser(app, email);
      const token = mail.extractToken(mail.latestFor(email)!);

      await request(app.getHttpServer())
        .post('/auth/verify-email/confirm')
        .send({ token })
        .expect(200);

      const secondAttempt = await request(app.getHttpServer())
        .post('/auth/verify-email/confirm')
        .send({ token });
      expect(secondAttempt.status).toBe(401);
    });

    it('rejects a garbage token', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email/confirm')
        .send({ token: 'not-a-real-token' })
        .expect(401);
    });
  });

  describe('sessions', () => {
    it('lists the active session and allows revoking it', async () => {
      const email = uniqueEmail('sessions');
      const { cookies } = await registerUser(app, email);

      const listRes = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Cookie', [cookies]);
      expect(listRes.status).toBe(200);
      expect(listRes.body).toHaveLength(1);

      const sessionId = listRes.body[0].id;
      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sessionId}`)
        .set('Cookie', [cookies])
        .expect(200);

      // The revoked session's refresh token can no longer be used.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', [cookies])
        .expect(401);
    });
  });
});
