import type { ConversionAuditBreakdown, ConversionAuditResult, WebsiteExtraction } from "@lead-radar/types";

// Weights sum to exactly 100.
const WEIGHTS: Record<keyof ConversionAuditBreakdown, number> = {
  hasContactCta: 20,
  phoneVisible: 15,
  emailVisible: 15,
  hasBookingCta: 20,
  hasContactPage: 15,
  hasServicePages: 15,
};

/**
 * Computes the Conversion Score (0-100) — how easy the crawled site makes it
 * for a visitor to actually get in touch or book. "Visible" means found by
 * LeadRadar's crawl (a mailto:/tel: link, on-page number, or a booking URL),
 * never assumed.
 */
export function computeConversionAudit(extraction: WebsiteExtraction): ConversionAuditResult {
  const breakdown: ConversionAuditBreakdown = {
    hasContactCta: extraction.hasContactCta,
    phoneVisible: extraction.phones.length > 0,
    emailVisible: extraction.emails.length > 0,
    hasBookingCta: !!extraction.bookingUrl,
    hasContactPage: !!extraction.contactUrl,
    hasServicePages: extraction.serviceInfo.length > 0,
  };

  let score = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof ConversionAuditBreakdown)[]) {
    if (breakdown[key]) score += WEIGHTS[key];
  }

  return { score, breakdown };
}
