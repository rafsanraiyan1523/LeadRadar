import { afterEach, describe, expect, it, vi } from "vitest";
import { crawlWebsite, type CrawlerConfig } from "./crawler";

// crawlWebsite -> fetchWithLimits calls undici's own `fetch` (see the
// comment in fetch-with-limits.ts) rather than the global one, so that's
// what needs mocking here.
vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return { ...actual, fetch: vi.fn() };
});

import { fetch as undiciFetch } from "undici";
const fetchMock = vi.mocked(undiciFetch);

afterEach(() => {
  vi.clearAllMocks();
});

const TEST_CONFIG: CrawlerConfig = {
  maxPages: 5,
  maxResponseBytes: 2_000_000,
  timeoutMs: 5000,
  requestDelayMs: 0,
};

function htmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
}

function mockSite(pages: Record<string, string>, robotsTxt = "User-agent: *\n") {
  fetchMock.mockImplementation((url) => {
    const path = new URL(url as string).pathname;
    if (path === "/robots.txt") {
      return Promise.resolve(
        new Response(robotsTxt, { status: 200, headers: { "content-type": "text/plain" } }) as never,
      );
    }
    if (path in pages) {
      return Promise.resolve(htmlResponse(pages[path]!) as never);
    }
    return Promise.resolve(new Response("Not found", { status: 404 }) as never);
  });
}

const HOMEPAGE = `<html lang="en"><head><title>Example Cafe</title></head><body>
  <h1>Example Cafe</h1>
  <a href="/contact">Contact us</a>
  <a href="/about">About</a>
  <a href="https://facebook.com/examplecafe">Facebook</a>
</body></html>`;

const CONTACT_PAGE = `<html><body>
  <h1>Contact</h1>
  <a href="mailto:hello@examplecafe.test">hello@examplecafe.test</a>
  <a href="tel:+8801711111111">+880 1711 111111</a>
</body></html>`;

const ABOUT_PAGE = `<html><body><h1>About us</h1><p>We've been serving coffee since 2010.</p></body></html>`;

describe("crawlWebsite", () => {
  it("crawls the homepage plus discovered contact/about pages and merges results", async () => {
    mockSite({ "/": HOMEPAGE, "/contact": CONTACT_PAGE, "/about": ABOUT_PAGE });

    const result = await crawlWebsite("https://examplecafe.test/", TEST_CONFIG);

    expect(result.pagesCrawled).toHaveLength(3);
    expect(result.emails).toContain("hello@examplecafe.test");
    expect(result.phones).toContain("+8801711111111");
    expect(result.socialLinks).toEqual([{ platform: "FACEBOOK", url: "https://facebook.com/examplecafe" }]);
    expect(result.title).toBe("Example Cafe");
    expect(result.https).toBe(true);
    expect(result.performance.homepageResponseTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.performance.homepageSizeBytes).toBeGreaterThan(0);
    expect(result.brokenLinksChecked).toBe(2); // /contact and /about, discovered from the homepage
    expect(result.brokenLinksFound).toBe(0);
  });

  it("counts a discovered priority link that 404s as a broken link", async () => {
    mockSite({ "/": HOMEPAGE, "/about": ABOUT_PAGE }); // /contact will 404

    const result = await crawlWebsite("https://examplecafe.test/", TEST_CONFIG);

    expect(result.brokenLinksChecked).toBe(2);
    expect(result.brokenLinksFound).toBe(1);
  });

  it("never crawls more than MAX_PAGES pages", async () => {
    const manyLinksHomepage = `<html><body>
      <a href="/contact">Contact</a>
      <a href="/about">About</a>
      <a href="/services">Services</a>
      <a href="/book-now">Book</a>
    </body></html>`;
    mockSite({
      "/": manyLinksHomepage,
      "/contact": "<html><body>Contact page</body></html>",
      "/about": "<html><body>About page</body></html>",
      "/services": "<html><body>Services page</body></html>",
      "/book-now": "<html><body>Booking page</body></html>",
    });

    const result = await crawlWebsite("https://examplecafe.test/", { ...TEST_CONFIG, maxPages: 2 });

    expect(result.pagesCrawled).toHaveLength(2);
  });

  it("respects robots.txt Disallow rules", async () => {
    mockSite(
      { "/": HOMEPAGE, "/contact": CONTACT_PAGE, "/about": ABOUT_PAGE },
      "User-agent: *\nDisallow: /contact\n",
    );

    const result = await crawlWebsite("https://examplecafe.test/", TEST_CONFIG);

    expect(result.pagesCrawled).not.toContain("https://examplecafe.test/contact");
    // The disallowed page's email must not leak in through some other path.
    expect(result.emails).not.toContain("hello@examplecafe.test");
  });

  it("returns an empty, honest result for an invalid URL rather than throwing", async () => {
    const result = await crawlWebsite("not-a-url", TEST_CONFIG);
    expect(result.pagesCrawled).toEqual([]);
    expect(result.emails).toEqual([]);
  });

  it("keeps going and returns partial results when one page 404s", async () => {
    mockSite({ "/": HOMEPAGE, "/about": ABOUT_PAGE }); // /contact will 404

    const result = await crawlWebsite("https://examplecafe.test/", TEST_CONFIG);

    expect(result.pagesCrawled).toContain("https://examplecafe.test/");
    expect(result.pagesCrawled).toContain("https://examplecafe.test/about");
    expect(result.pagesCrawled).not.toContain("https://examplecafe.test/contact");
  });

  it("does not fabricate any results for a site with no discoverable contact info", async () => {
    mockSite({ "/": "<html><body><h1>Nothing here</h1></body></html>" });

    const result = await crawlWebsite("https://examplecafe.test/", TEST_CONFIG);

    expect(result.emails).toEqual([]);
    expect(result.phones).toEqual([]);
    expect(result.socialLinks).toEqual([]);
    expect(result.contactUrl).toBeNull();
    expect(result.bookingUrl).toBeNull();
  });
});
