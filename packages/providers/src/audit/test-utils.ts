import type { WebsiteExtraction } from "@lead-radar/types";

/** Shared "everything present" fixture for the audit unit tests — override only what a given test needs to vary. */
export function buildExtraction(overrides: Partial<WebsiteExtraction> = {}): WebsiteExtraction {
  return {
    startUrl: "https://example.test/",
    https: true,
    emails: ["hello@example.test"],
    phones: ["+8801711111111"],
    socialLinks: [{ platform: "FACEBOOK", url: "https://facebook.com/example" }],
    contactUrl: "https://example.test/contact",
    bookingUrl: "https://example.test/book",
    hasContactCta: true,
    title: "Example Business",
    metaDescription: "We do things",
    h1: "Example Business",
    headings: ["Example Business"],
    canonical: "https://example.test/",
    robotsMeta: "index, follow",
    sitemapUrl: "https://example.test/sitemap.xml",
    openGraph: { "og:title": "Example" },
    structuredData: [{ "@type": "LocalBusiness" }],
    viewport: "width=device-width, initial-scale=1",
    serviceInfo: ["Haircuts", "Coloring"],
    accessibility: {
      totalImages: 4,
      imagesWithoutAlt: 0,
      hasLangAttribute: true,
      headingHierarchyOk: true,
      hasViewportMeta: true,
    },
    technologies: ["WordPress"],
    pagesCrawled: ["https://example.test/", "https://example.test/contact"],
    robotsTxtRespected: true,
    performance: { homepageResponseTimeMs: 100, homepageSizeBytes: 5000 },
    brokenLinksChecked: 1,
    brokenLinksFound: 0,
    ...overrides,
  };
}
