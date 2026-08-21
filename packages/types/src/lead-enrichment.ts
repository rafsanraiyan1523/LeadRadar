export const LEAD_ENRICHMENT_QUEUE = "lead-enrichment";

export interface LeadEnrichmentJobData {
  leadId: string;
  organizationId: string;
  /** Who triggered this run — the completion/failure Notification is addressed to them. */
  triggeredByUserId: string;
}

/**
 * These mirror Prisma enum values (EnrichmentStatus, SocialPlatform) but are
 * re-declared here rather than imported from @lead-radar/db, so this
 * package has no runtime dependency on the generated Prisma client.
 */
export type EnrichmentStatus = "NOT_STARTED" | "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type SocialPlatformName = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "YOUTUBE" | "TIKTOK";

export interface AccessibilitySignals {
  totalImages: number;
  imagesWithoutAlt: number;
  hasLangAttribute: boolean;
  /** True if heading levels appear in a sane order (no jump from h1 straight to h4, etc.). */
  headingHierarchyOk: boolean;
  hasViewportMeta: boolean;
}

export interface SocialLink {
  platform: SocialPlatformName;
  url: string;
}

/**
 * Everything extracted from a single crawled page. The crawler merges these
 * across up to MAX_PAGES pages into one WebsiteExtraction (see below).
 */
export interface PageExtraction {
  url: string;
  emails: string[];
  phones: string[];
  socialLinks: SocialLink[];
  contactUrl: string | null;
  bookingUrl: string | null;
  /** A direct mailto:/tel: link or an explicit contact/booking call-to-action was found on this page. */
  hasContactCta: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  canonical: string | null;
  robotsMeta: string | null;
  openGraph: Record<string, string>;
  structuredData: unknown[];
  viewport: string | null;
  serviceInfo: string[];
  accessibility: AccessibilitySignals;
}

/** Basic, self-measured timing/size for the homepage fetch — a LeadRadar check, never a PageSpeed/Lighthouse score. */
export interface WebsitePerformanceSignals {
  homepageResponseTimeMs: number | null;
  homepageSizeBytes: number | null;
}

/** The merged result of crawling a lead's website — what gets persisted to LeadWebsite.metadata. */
export interface WebsiteExtraction {
  startUrl: string;
  https: boolean;
  emails: string[];
  phones: string[];
  socialLinks: SocialLink[];
  contactUrl: string | null;
  bookingUrl: string | null;
  hasContactCta: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  headings: string[];
  canonical: string | null;
  robotsMeta: string | null;
  sitemapUrl: string | null;
  openGraph: Record<string, string>;
  structuredData: unknown[];
  viewport: string | null;
  serviceInfo: string[];
  accessibility: AccessibilitySignals;
  technologies: string[];
  pagesCrawled: string[];
  robotsTxtRespected: boolean;
  performance: WebsitePerformanceSignals;
  /** Same-origin contact/about/services/booking links discovered on the homepage that the crawler then tried to fetch. */
  brokenLinksChecked: number;
  /** Of those, how many failed to load (non-2xx, timeout, network error) — a basic broken-link signal, not a full link audit. */
  brokenLinksFound: number;
}

export interface ContactabilitySignals {
  hasPhone: boolean;
  hasEmail: boolean;
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasBookingUrl: boolean;
  hasContactPage: boolean;
  hasContactCta: boolean;
}

export interface ContactabilityResult {
  score: number;
  breakdown: Record<keyof ContactabilitySignals, boolean>;
}
