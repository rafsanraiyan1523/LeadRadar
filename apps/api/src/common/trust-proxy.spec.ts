import express from 'express';
import request from 'supertest';

/**
 * There's no dedicated module for this — it's one line in main.ts's
 * bootstrap (`app.set('trust proxy', 1)`, right before CORS is configured).
 * `main.ts` can't be imported directly in a test (it boots the real app as
 * an import-time side effect), so this proves the exact Express semantics
 * that line relies on, using a minimal Express app configured the same way.
 * The behavior under test is real, framework-level Express behavior —
 * confirming it here is confirming that main.ts's one line does what it's
 * meant to for a deployment sitting behind exactly one reverse proxy
 * (Render's edge).
 */
interface WhoAmI {
  ip: string;
  ips: string[];
}

function appWithTrustProxy(trustProxySetting: number | boolean | undefined) {
  const app = express();
  if (trustProxySetting !== undefined) {
    app.set('trust proxy', trustProxySetting);
  }
  app.get('/whoami', (req, res) => {
    const body: WhoAmI = { ip: req.ip ?? '', ips: req.ips };
    res.json(body);
  });
  return app;
}

/** supertest types Response#body as `any` (it's genuinely unknown JSON at the HTTP boundary) — one cast here, not scattered `any` access at every call site. */
function whoAmI(res: { body: unknown }): WhoAmI {
  return res.body as WhoAmI;
}

describe('trust proxy configuration (as applied in main.ts)', () => {
  it('without trust proxy configured, ignores X-Forwarded-For entirely (the pre-fix, buggy behavior)', async () => {
    const app = appWithTrustProxy(undefined);

    const res = await request(app)
      .get('/whoami')
      .set('X-Forwarded-For', '203.0.113.7');

    // No X-Forwarded-For trusted -> ips is empty, and req.ip falls back to
    // the raw socket peer (supertest's in-process connection), never the
    // spoofed/forwarded value. This is exactly the bug: every real client
    // behind Render's proxy would collapse to the proxy's own address.
    expect(whoAmI(res).ips).toEqual([]);
    expect(whoAmI(res).ip).not.toBe('203.0.113.7');
  });

  it("with trust proxy = 1 (main.ts's setting), resolves the real client IP from a single proxy hop", async () => {
    const app = appWithTrustProxy(1);

    const res = await request(app)
      .get('/whoami')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(whoAmI(res).ip).toBe('203.0.113.7');
  });

  it('with trust proxy = 1, does not blindly trust additional spoofed hops beyond the real single proxy', async () => {
    const app = appWithTrustProxy(1);

    // A client could append its own fake entries to X-Forwarded-For hoping
    // to be trusted as "further from the edge" than it really is. With
    // trust proxy = 1, Express only trusts the single hop closest to the
    // server (i.e. the one Render's own proxy appended) — the client's own
    // prepended, unverified entry must be ignored.
    const res = await request(app)
      .get('/whoami')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.7');

    expect(whoAmI(res).ip).toBe('203.0.113.7');
    expect(whoAmI(res).ip).not.toBe('198.51.100.99');
  });

  it('with trust proxy = true (the unsafe, not-used configuration), would trust the entire chain including client-spoofed hops — this is why main.ts uses 1, not true', async () => {
    const app = appWithTrustProxy(true);

    const res = await request(app)
      .get('/whoami')
      .set('X-Forwarded-For', '198.51.100.99, 203.0.113.7');

    // Demonstrates the unsafe alternative for contrast: trusting the whole
    // chain resolves to the client's own unverified, spoofable entry.
    expect(whoAmI(res).ip).toBe('198.51.100.99');
  });
});
