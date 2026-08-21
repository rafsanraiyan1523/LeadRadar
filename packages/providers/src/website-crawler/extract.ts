import * as cheerio from "cheerio";
import type { AccessibilitySignals, PageExtraction, SocialLink, SocialPlatformName } from "@lead-radar/types";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_CANDIDATE_REGEX = /(\+?\d[\d\s().-]{6,18}\d)/g;

const SOCIAL_PATTERNS: { platform: SocialPlatformName; hostPattern: RegExp }[] = [
  { platform: "FACEBOOK", hostPattern: /(^|\.)facebook\.com$/i },
  { platform: "INSTAGRAM", hostPattern: /(^|\.)instagram\.com$/i },
  { platform: "LINKEDIN", hostPattern: /(^|\.)linkedin\.com$/i },
  { platform: "YOUTUBE", hostPattern: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { platform: "TIKTOK", hostPattern: /(^|\.)tiktok\.com$/i },
];

const CONTACT_PAGE_PATTERN = /contact/i;
const BOOKING_PAGE_PATTERN = /\b(book(ing)?|schedule|appointment)\b/i;
const SERVICE_HEADING_PATTERN = /services?|what we (do|offer)|our work/i;

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function isImageOrAssetFilename(candidate: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|bmp|ico|css|js)(\?.*)?$/i.test(candidate);
}

function isLikelyVersionOrId(digits: string): boolean {
  // All-zero or strictly sequential runs (e.g. "0000000", "1234567") are
  // near-certainly not real phone numbers — filters common placeholder text.
  return /^0+$/.test(digits) || digits === "1234567" || digits === "12345678";
}

function extractEmailsFromText(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) ?? [];
  const cleaned = matches
    .map((m) => m.trim().replace(/\.+$/, "").toLowerCase())
    .filter((m) => !isImageOrAssetFilename(m));
  return dedupe(cleaned);
}

function extractPhonesFromText(text: string): string[] {
  const matches = text.match(PHONE_CANDIDATE_REGEX) ?? [];
  const cleaned = matches
    .map((m) => m.trim())
    .filter((m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15 && !isLikelyVersionOrId(digits);
    });
  return dedupe(cleaned);
}

function toAbsoluteUrl(href: string, base: string): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

function checkHeadingHierarchy($: cheerio.CheerioAPI): boolean {
  const levels: number[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const tag = "tagName" in el ? String(el.tagName) : "";
    const level = Number(tag.replace(/[^0-9]/g, ""));
    if (level) levels.push(level);
  });
  for (let i = 1; i < levels.length; i++) {
    if (levels[i]! - levels[i - 1]! > 1) return false;
  }
  return true;
}

function extractServiceInfo($: cheerio.CheerioAPI): string[] {
  const results: string[] = [];
  $("h1,h2,h3,h4").each((_, el) => {
    const heading = $(el).text().trim();
    if (!SERVICE_HEADING_PATTERN.test(heading)) return;

    let sibling = $(el).next();
    let hops = 0;
    while (sibling.length && hops < 5 && results.length < 15) {
      if (sibling.is("h1,h2,h3,h4,h5,h6")) break;
      if (sibling.is("ul,ol")) {
        sibling.find("li").each((_, li) => {
          const text = $(li).text().trim();
          if (text) results.push(text);
        });
      } else {
        const text = sibling.text().trim();
        if (text && text.length < 200) results.push(text);
      }
      sibling = sibling.next();
      hops++;
    }
  });
  return dedupe(results).slice(0, 15);
}

export function extractFromPage(html: string, pageUrl: string): PageExtraction {
  // Read JSON-LD from the untouched document first — the main `$` below
  // strips <script> tags (so regex text-scanning doesn't pick up JS
  // source), which would remove the structured-data scripts too.
  const $raw = cheerio.load(html);
  const structuredData: unknown[] = [];
  $raw('script[type="application/ld+json"]').each((_, el) => {
    const raw = $raw(el).contents().text();
    try {
      structuredData.push(JSON.parse(raw));
    } catch {
      // malformed JSON-LD on the page — skip rather than fabricate a parse
    }
  });

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const bodyText = $("body").text();

  const mailtoEmails = $('a[href^="mailto:"]')
    .map((_, el) => $(el).attr("href")?.replace(/^mailto:/i, "").split("?")[0]?.trim())
    .get()
    .filter((v): v is string => !!v);
  const emails = dedupe([...mailtoEmails, ...extractEmailsFromText(bodyText)].map((e) => e.toLowerCase()));

  const telPhones = $('a[href^="tel:"]')
    .map((_, el) => $(el).attr("href")?.replace(/^tel:/i, "").trim())
    .get()
    .filter((v): v is string => !!v);
  const phones = dedupe([...telPhones, ...extractPhonesFromText(bodyText)]);

  const socialLinks: SocialLink[] = [];
  const seenSocial = new Set<string>();
  let contactUrl: string | null = null;
  let bookingUrl: string | null = null;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const absolute = toAbsoluteUrl(href, pageUrl);
    if (!absolute) return;
    const linkText = $(el).text();

    for (const { platform, hostPattern } of SOCIAL_PATTERNS) {
      if (hostPattern.test(absolute.hostname) && absolute.pathname.length > 1) {
        const key = `${platform}:${absolute.origin}${absolute.pathname}`;
        if (!seenSocial.has(key)) {
          seenSocial.add(key);
          socialLinks.push({ platform, url: absolute.toString() });
        }
        break;
      }
    }

    if (!contactUrl && (CONTACT_PAGE_PATTERN.test(absolute.pathname) || CONTACT_PAGE_PATTERN.test(linkText))) {
      contactUrl = absolute.toString();
    }
    if (!bookingUrl && (BOOKING_PAGE_PATTERN.test(absolute.pathname) || BOOKING_PAGE_PATTERN.test(linkText))) {
      bookingUrl = absolute.toString();
    }
  });

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;
  const headings = $("h1, h2, h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 30);
  const canonicalHref = $('link[rel="canonical"]').attr("href");
  const canonical = canonicalHref ? (toAbsoluteUrl(canonicalHref, pageUrl)?.toString() ?? null) : null;
  const robotsMeta = $('meta[name="robots"]').attr("content")?.trim() || null;
  const viewport = $('meta[name="viewport"]').attr("content")?.trim() || null;

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr("property");
    const content = $(el).attr("content");
    if (property && content) openGraph[property] = content;
  });

  const images = $("img");
  const totalImages = images.length;
  const imagesWithoutAlt = images.filter((_, el) => !$(el).attr("alt")?.trim()).length;
  const accessibility: AccessibilitySignals = {
    totalImages,
    imagesWithoutAlt,
    hasLangAttribute: !!$("html").attr("lang"),
    headingHierarchyOk: checkHeadingHierarchy($),
    hasViewportMeta: !!viewport,
  };

  const hasDirectMailtoOrTel = mailtoEmails.length > 0 || telPhones.length > 0;

  return {
    url: pageUrl,
    emails,
    phones,
    socialLinks,
    contactUrl,
    bookingUrl,
    hasContactCta: hasDirectMailtoOrTel || !!bookingUrl,
    title,
    metaDescription,
    h1,
    headings,
    canonical,
    robotsMeta,
    openGraph,
    structuredData,
    viewport,
    serviceInfo: extractServiceInfo($),
    accessibility,
  };
}
