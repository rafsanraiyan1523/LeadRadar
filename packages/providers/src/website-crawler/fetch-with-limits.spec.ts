import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithLimits } from "./fetch-with-limits";

// `fetchWithLimits` calls undici's own `fetch` (not the global one) — see
// the comment in fetch-with-limits.ts for why. Mock only the `fetch` export
// so the real `Agent`/connector machinery stays intact for the SSRF tests
// further down, which deliberately do NOT mock anything and instead let a
// real (loopback-only) connection attempt run through the real safe-lookup
// guard.
vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return { ...actual, fetch: vi.fn() };
});

import { fetch as undiciFetch } from "undici";
const fetchMock = vi.mocked(undiciFetch);

afterEach(() => {
  vi.clearAllMocks();
});

const CONFIG = { timeoutMs: 5000, maxResponseBytes: 2_000_000 };

describe("fetchWithLimits", () => {
  it("rejects an invalid URL without attempting a network call", async () => {
    const result = await fetchWithLimits("not a url", CONFIG);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid url/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) URL", async () => {
    const result = await fetchWithLimits("ftp://example.test/file", CONFIG);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/protocol/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a 403 as a clean failure, not a thrown error", async () => {
    fetchMock.mockResolvedValue(new Response("Forbidden", { status: 403 }) as never);

    const result = await fetchWithLimits("https://example.test/private", CONFIG);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it("surfaces a 404 as a clean failure", async () => {
    fetchMock.mockResolvedValue(new Response("Not found", { status: 404 }) as never);

    const result = await fetchWithLimits("https://example.test/missing", CONFIG);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("follows a redirect and reports the final URL", async () => {
    // The Response constructor doesn't let us set `.url` directly; define
    // it to simulate what a real fetch() reports after following a 3xx.
    // (Redirect-following itself happens inside undici's fetch()
    // implementation — mocking it out here is correct, since this test is
    // about finalUrl reporting, not the redirect mechanics.)
    fetchMock.mockImplementation(() => {
      const response = new Response("<html><body>ok</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
      Object.defineProperty(response, "url", { value: "https://example.test/new-location" });
      return Promise.resolve(response as never);
    });

    const result = await fetchWithLimits("https://example.test/old-location", CONFIG);
    expect(result.ok).toBe(true);
    expect(result.finalUrl).toBe("https://example.test/new-location");
  });

  it("times out cleanly instead of hanging forever", async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init as RequestInit)?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        }) as never,
    );

    const result = await fetchWithLimits("https://example.test/slow", { timeoutMs: 20, maxResponseBytes: 2_000_000 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });

  it("stops reading once the response exceeds the configured max size", async () => {
    const chunk = new Uint8Array(1000).fill(97); // 1000 bytes of 'a'
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    fetchMock.mockResolvedValue(
      new Response(stream, { status: 200, headers: { "content-type": "text/html" } }) as never,
    );

    const result = await fetchWithLimits("https://example.test/huge", { timeoutMs: 5000, maxResponseBytes: 2000 });
    expect(result.ok).toBe(true);
    // We asked for at most 2000 bytes but the stream yields in 1000-byte
    // chunks, so it should stop after the 2nd chunk (~2000 bytes) rather
    // than reading the full ~10000-byte body.
    expect(result.text.length).toBeLessThan(5000);
  });

  describe("SSRF protection", () => {
    // IP-literal and known-blocked hostnames are caught by a synchronous
    // pre-check (isBlockedHostname) before fetch is ever called — see the
    // comment on that function for why this has to be a separate check
    // from the DNS-time `createSafeLookup` guard (Node's connector skips a
    // custom `lookup` entirely for literal IPs). These assert on that
    // pre-check directly, so they're fast and need no network access; the
    // DNS-time path (hostnames that resolve to a private address) is
    // covered by createSafeLookup's own tests in url-safety.spec.ts.
    it.each([
      ["http://127.0.0.1:6379/", "loopback IP literal"],
      ["http://169.254.169.254/latest/meta-data/", "cloud metadata address"],
      ["http://10.0.0.5/", "private RFC1918 address"],
      ["http://localhost:5432/", "localhost hostname"],
      ["http://printer.local/", "a .local hostname"],
    ])("blocks %s (%s) without ever calling fetch", async (url) => {
      const result = await fetchWithLimits(url, { timeoutMs: 3000, maxResponseBytes: 1000 });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/blocked/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
