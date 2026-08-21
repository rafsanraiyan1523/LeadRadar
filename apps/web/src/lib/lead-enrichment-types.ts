export type EnrichmentStatus = "NOT_STARTED" | "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type ContactType = "PHONE" | "EMAIL" | "WEBSITE" | "BOOKING_URL";
export type ContactSource = "GOOGLE_PLACES" | "WEBSITE" | "MANUAL";
export type SocialPlatform = "FACEBOOK" | "INSTAGRAM" | "LINKEDIN" | "YOUTUBE" | "TIKTOK";

export interface LeadContact {
  id: string;
  leadId: string;
  type: ContactType;
  value: string;
  source: ContactSource;
  verified: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface LeadSocialProfile {
  id: string;
  leadId: string;
  platform: SocialPlatform;
  url: string;
}

export interface LeadWebsite {
  id: string;
  leadId: string;
  url: string;
  isReachable: boolean | null;
  hasSsl: boolean | null;
  technologies: unknown;
  metadata: unknown;
  pagesCrawled: number | null;
  lastCheckedAt: string | null;
}

export interface WebsiteAudit {
  id: string;
  leadId: string;
  performanceScore: number | null;
  seoScore: number | null;
  accessibilityScore: number | null;
  hasSsl: boolean | null;
  isMobileFriendly: boolean | null;
  techStack: string[];
  issues: string[] | null;
  auditedAt: string;
}

export interface ContactabilityBreakdown {
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
  breakdown: ContactabilityBreakdown;
}

export interface LeadEnrichment {
  leadId: string;
  businessName: string;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  enrichment: {
    status: EnrichmentStatus;
    progress: number;
    error: string | null;
    lastEnrichedAt: string | null;
  };
  contactability: ContactabilityResult;
  contacts: LeadContact[];
  socialProfiles: LeadSocialProfile[];
  website: LeadWebsite | null;
  latestAudit: WebsiteAudit | null;
}

export interface EnrichLeadResponse {
  leadId: string;
  status: EnrichmentStatus;
  alreadyInProgress: boolean;
}
