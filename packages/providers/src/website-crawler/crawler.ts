import * as cheerio from "cheerio";
import type { PageExtraction, SocialLink, WebsiteExtraction } from "@lead-radar/types";
import { fetchWithLimits } from "./fetch-with-limits";
import { parseRobotsTxt, isPathAllowed } from "./robots";
import { extractFromPage } from "./extract";
import { detectTechnologies } from "./tech-detect";

export interface CrawlerConfig {
  maxPages: number;
  maxResponseBytes: number;
  timeoutMs: number;
  requestDelayMs: number;
  userAgent?: string;
}

export const DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
  maxPages: 5,
  maxResponseBytes: 2_000_000,
  timeoutMs: 8000,
  requestDelayMs: 300,
};

const PRIORITY_PAGE_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: "contact", pattern: /contact/i },
  { key: "about", pattern: /about/i },
  { key: "services", pattern: /service/i },
  { key: "booking", pattern: /\b(book(ing)?|schedule|appointment)\b/i },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function discoverPriorityLinks(html: string, pageUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const found = new Map<string, string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (absolute.origin !== origin) return;
    absolute.hash = "";

    for (const { key, pattern } of PRIORITY_PAGE_PATTERNS) {
      if (!found.has(key) && pattern.test(absolute.pathname)) {
        found.set(key, absolute.toString());
      }
    }
  });

  return Array.from(found.values());
}

function mergeExtractions(
  startUrl: string,
  pages: PageExtraction[],
  technologies: string[],
  https: boolean,
  sitemapUrl: string | null,
  robotsTxtRespected: boolean,
  performance: WebsiteExtraction["performance"],
  brokenLinksChecked: number,
  brokenLinksFound: number,
): WebsiteExtraction {
  const homepage = pages[0];
  const socialLinksByKey = new Map<string, SocialLink>();
  for (const page of pages) {
    for (const link of page.socialLinks) {
      socialLinksByKey.set(`${link.platform}:${link.url}`, link);
    }
  }

  return {
    startUrl,
    https,
    emails: Array.from(new Set(pages.flatMap((p) => p.emails))),
    phones: Array.from(new Set(pages.flatMap((p) => p.phones))),
    socialLinks: Array.from(socialLinksByKey.values()),
    contactUrl: pages.find((p) => p.contactUrl)?.contactUrl ?? null,
    bookingUrl: pages.find((p) => p.bookingUrl)?.bookingUrl ?? null,
    hasContactCta: pages.some((p) => p.hasContactCta),
    title: homepage?.title ?? null,
    metaDescription: homepage?.metaDescription ?? null,
    h1: homepage?.h1 ?? null,
    headings: homepage?.headings ?? [],
    canonical: homepage?.canonical ?? null,
    robotsMeta: homepage?.robotsMeta ?? null,
    sitemapUrl,
    openGraph: homepage?.openGraph ?? {},
    structuredData: pages.flatMap((p) => p.structuredData),
    viewport: homepage?.viewport ?? null,
    serviceInfo: Array.from(new Set(pages.flatMap((p) => p.serviceInfo))).slice(0, 15),
    accessibility: homepage?.accessibility ?? {
      totalImages: 0,
      imagesWithoutAlt: 0,
      hasLangAttribute: false,
      headingHierarchyOk: true,
      hasViewportMeta: false,
    },
    technologies,
    pagesCrawled: pages.map((p) => p.url),
    robotsTxtRespected,
    performance,
    brokenLinksChecked,
    brokenLinksFound,
  };
}

function emptyExtraction(startUrl: string): WebsiteExtraction {
  return {
    startUrl,
    https: false,
    emails: [],
    phones: [],
    socialLinks: [],
    contactUrl: null,
    bookingUrl: null,
    hasContactCta: false,
    title: null,
    metaDescription: null,
    h1: null,
    headings: [],
    canonical: null,
    robotsMeta: null,
    sitemapUrl: null,
    openGraph: {},
    structuredData: [],
    viewport: null,
    serviceInfo: [],
    accessibility: {
      totalImages: 0,
      imagesWithoutAlt: 0,
      hasLangAttribute: false,
      headingHierarchyOk: true,
      hasViewportMeta: false,
    },
    technologies: [],
    pagesCrawled: [],
    robotsTxtRespected: false,
    performance: { homepageResponseTimeMs: null, homepageSizeBytes: null },
    brokenLinksChecked: 0,
    brokenLinksFound: 0,
  };
}

/**
 * Crawls up to `config.maxPages` public pages of a single site starting
 * from `startUrl` — the homepage, then same-origin contact/about/services/
 * booking pages discovered from the homepage's own links. Never follows
 * links found on non-homepage pages (bounded breadth, not a general
 * crawler), respects robots.txt, and rate-limits itself with a delay
 * between requests.
 */
export async function crawlWebsite(
  startUrl: string,
  config: CrawlerConfig = DEFAULT_CRAWLER_CONFIG,
): Promise<WebsiteExtraction> {
  let origin: URL;
  try {
    origin = new URL(startUrl);
  } catch {
    return emptyExtraction(startUrl);
  }
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    return emptyExtraction(startUrl);
  }

  const robotsResult = await fetchWithLimits(`${origin.origin}/robots.txt`, config);
  const robots = robotsResult.ok ? parseRobotsTxt(robotsResult.text) : { disallow: [], sitemap: null };

  const visited = new Set<string>();
  const toVisit: string[] = [origin.toString()];
  const pages: PageExtraction[] = [];
  const technologies = new Set<string>();
  let sawHttps = origin.protocol === "https:";
  let performance: WebsiteExtraction["performance"] = { homepageResponseTimeMs: null, homepageSizeBytes: null };
  let brokenLinksChecked = 0;
  let brokenLinksFound = 0;

  while (toVisit.length > 0 && pages.length < config.maxPages) {
    const nextUrl = toVisit.shift();
    if (!nextUrl) break;

    let parsedNext: URL;
    try {
      parsedNext = new URL(nextUrl);
    } catch {
      continue;
    }
    const key = parsedNext.toString();
    if (visited.has(key)) continue;
    visited.add(key);
    const isHomepage = key === origin.toString();

    if (!isPathAllowed(parsedNext.pathname, robots.disallow)) continue;

    if (pages.length > 0) {
      await delay(config.requestDelayMs);
    }

    const result = await fetchWithLimits(key, config);

    // Priority links (contact/about/services/booking) discovered on the
    // homepage are the only non-homepage fetches this crawler ever makes —
    // a failure here is a genuine, bounded broken-link signal.
    if (!isHomepage) {
      brokenLinksChecked++;
      if (!result.ok) brokenLinksFound++;
    }

    if (!result.ok || !result.contentType.includes("html")) continue;

    if (isHomepage) {
      performance = { homepageResponseTimeMs: result.durationMs, homepageSizeBytes: result.bytes };
    }

    if (new URL(result.finalUrl).protocol === "https:") sawHttps = true;

    for (const tech of detectTechnologies(result.text)) technologies.add(tech);
    pages.push(extractFromPage(result.text, result.finalUrl));

    if (pages.length === 1) {
      for (const link of discoverPriorityLinks(result.text, result.finalUrl, origin.origin)) {
        if (!visited.has(link) && !toVisit.includes(link)) toVisit.push(link);
      }
    }
  }

  return mergeExtractions(
    startUrl,
    pages,
    Array.from(technologies),
    sawHttps,
    robots.sitemap,
    true,
    performance,
    brokenLinksChecked,
    brokenLinksFound,
  );
}
