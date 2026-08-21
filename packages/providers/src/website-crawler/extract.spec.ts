import { describe, expect, it } from "vitest";
import { extractFromPage } from "./extract";

const BASE_URL = "https://example-business.test/";

describe("extractFromPage — email extraction", () => {
  it("finds a mailto: link email with high confidence", () => {
    const html = `<html><body><a href="mailto:hello@example-business.test">Email us</a></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.emails).toContain("hello@example-business.test");
  });

  it("finds a plain-text email mentioned in the page body", () => {
    const html = `<html><body><p>Reach us at contact@example-business.test for quotes.</p></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.emails).toContain("contact@example-business.test");
  });

  it("does not fabricate an email when none is present", () => {
    const html = `<html><body><p>We have no contact details listed here.</p></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.emails).toEqual([]);
  });

  it("filters out image-filename false positives that merely look like emails", () => {
    const html = `<html><body><img src="team@2x.png" alt="team" /></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.emails).toEqual([]);
  });

  it("deduplicates repeated email mentions", () => {
    const html = `<html><body>
      <a href="mailto:hello@example-business.test">Email</a>
      <p>Or write to hello@example-business.test directly.</p>
    </body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.emails).toEqual(["hello@example-business.test"]);
  });
});

describe("extractFromPage — phone extraction", () => {
  it("finds a tel: link phone number", () => {
    const html = `<html><body><a href="tel:+8801712345678">Call us</a></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.phones).toContain("+8801712345678");
  });

  it("finds a plain-text phone number in the page body", () => {
    const html = `<html><body><p>Call us at +880 1712-345678 anytime.</p></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.phones.length).toBeGreaterThan(0);
  });

  it("does not fabricate a phone number when none is present", () => {
    const html = `<html><body><p>No phone listed.</p></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.phones).toEqual([]);
  });

  it("ignores short numeric noise that isn't a plausible phone number", () => {
    const html = `<html><body><p>Room 42, floor 3, item #12.</p></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.phones).toEqual([]);
  });
});

describe("extractFromPage — social link extraction", () => {
  it("extracts links for every supported platform", () => {
    const html = `<html><body>
      <a href="https://www.facebook.com/examplebiz">Facebook</a>
      <a href="https://instagram.com/examplebiz">Instagram</a>
      <a href="https://www.linkedin.com/company/examplebiz">LinkedIn</a>
      <a href="https://www.youtube.com/@examplebiz">YouTube</a>
      <a href="https://www.tiktok.com/@examplebiz">TikTok</a>
    </body></html>`;
    const result = extractFromPage(html, BASE_URL);
    const platforms = result.socialLinks.map((l) => l.platform).sort();
    expect(platforms).toEqual(["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK", "YOUTUBE"]);
  });

  it("does not treat the bare facebook.com homepage as a business profile", () => {
    const html = `<html><body><a href="https://www.facebook.com/">Facebook</a></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.socialLinks).toEqual([]);
  });

  it("never invents a social profile that isn't linked on the page", () => {
    const html = `<html><body><p>Follow us on social media!</p></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.socialLinks).toEqual([]);
  });

  it("deduplicates the same profile linked twice", () => {
    const html = `<html><body>
      <a href="https://facebook.com/examplebiz">FB header</a>
      <a href="https://facebook.com/examplebiz">FB footer</a>
    </body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.socialLinks).toHaveLength(1);
  });
});

describe("extractFromPage — page metadata", () => {
  it("extracts title, meta description, headings, canonical, robots, viewport, Open Graph, and JSON-LD", () => {
    const html = `<html lang="en"><head>
      <title>Example Business — Home</title>
      <meta name="description" content="We do great work." />
      <link rel="canonical" href="/canonical-page" />
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:title" content="Example Business" />
      <script type="application/ld+json">{"@type":"LocalBusiness","name":"Example Business"}</script>
    </head><body>
      <h1>Welcome to Example Business</h1>
      <h2>Our story</h2>
    </body></html>`;
    const result = extractFromPage(html, BASE_URL);

    expect(result.title).toBe("Example Business — Home");
    expect(result.metaDescription).toBe("We do great work.");
    expect(result.h1).toBe("Welcome to Example Business");
    expect(result.headings).toContain("Our story");
    expect(result.canonical).toBe("https://example-business.test/canonical-page");
    expect(result.robotsMeta).toBe("index, follow");
    expect(result.viewport).toContain("width=device-width");
    expect(result.openGraph["og:title"]).toBe("Example Business");
    expect(result.structuredData).toHaveLength(1);
    expect(result.accessibility.hasLangAttribute).toBe(true);
  });

  it("reports basic accessibility signals honestly (missing alt text, no lang, no viewport)", () => {
    const html = `<html><body><img src="a.jpg" /><img src="b.jpg" alt="b" /></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.accessibility.totalImages).toBe(2);
    expect(result.accessibility.imagesWithoutAlt).toBe(1);
    expect(result.accessibility.hasLangAttribute).toBe(false);
    expect(result.accessibility.hasViewportMeta).toBe(false);
  });

  it("finds a contact page link and a booking page link", () => {
    const html = `<html><body>
      <a href="/contact-us">Contact</a>
      <a href="/book-a-table">Book now</a>
    </body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.contactUrl).toBe("https://example-business.test/contact-us");
    expect(result.bookingUrl).toBe("https://example-business.test/book-a-table");
    expect(result.hasContactCta).toBe(true);
  });

  it("leaves contact/booking URLs null rather than guessing when absent", () => {
    const html = `<html><body><a href="/menu">Menu</a></body></html>`;
    const result = extractFromPage(html, BASE_URL);
    expect(result.contactUrl).toBeNull();
    expect(result.bookingUrl).toBeNull();
    expect(result.hasContactCta).toBe(false);
  });
});
