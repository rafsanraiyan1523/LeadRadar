import type { FindingCategory, GrowthOpportunityFinding, RecommendedService, RecommendedServiceType } from "@lead-radar/types";

/**
 * Maps a detected GrowthOpportunityFinding to the service(s) it justifies.
 * Deliberately rule-based, not AI-generated — a service is only ever
 * recommended when a specific, already-verified finding evidences it. Keys
 * not present here (e.g. "ECOMMERCE", "PAID_ADS" triggers) simply never
 * fire, because LeadRadar has no detector for those signals yet — that is
 * the correct behavior, not a gap to paper over with an AI guess.
 */
const FINDING_TITLE_TO_SERVICES: Record<string, RecommendedServiceType[]> = {
  "No website detected": ["WEBSITE_DEVELOPMENT"],
  "Site is not served over HTTPS": ["WEBSITE_DEVELOPMENT"],
  "No online booking detected": ["ONLINE_BOOKING"],
  "Weak calls-to-action": ["WEBSITE_DEVELOPMENT"],
  "Missing SEO metadata": ["SEO"],
  "Weak mobile configuration": ["WEBSITE_DEVELOPMENT"],
  "No social links found on website": ["SOCIAL_MEDIA"],
  "No clear service pages": ["WEBSITE_DEVELOPMENT"],
  "No Google Business Profile found": ["GOOGLE_BUSINESS_OPTIMIZATION"],
  "Strong rating but limited review volume": ["GOOGLE_BUSINESS_OPTIMIZATION"],
};

// Fallback keyed on category, for a finding title this table hasn't seen
// yet (defensive — every current finding title above is already covered).
const CATEGORY_TO_SERVICES: Record<FindingCategory, RecommendedServiceType[]> = {
  website: ["WEBSITE_DEVELOPMENT"],
  seo: ["SEO"],
  conversion: ["WEBSITE_DEVELOPMENT"],
  mobile: ["WEBSITE_DEVELOPMENT"],
  technical: ["WEBSITE_DEVELOPMENT"],
  "google-business": ["GOOGLE_BUSINESS_OPTIMIZATION"],
  social: ["SOCIAL_MEDIA"],
  content: ["WEBSITE_DEVELOPMENT"],
};

/**
 * RECOMMENDED SERVICES: "Based on detected problems" — a pure, deterministic
 * function over already-verified GrowthOpportunity findings. Never calls an
 * AIProvider and never invents a service without a specific triggering
 * finding. Findings are deduplicated per service and merged, most-findings-first.
 */
export function mapFindingsToRecommendedServices(findings: GrowthOpportunityFinding[]): RecommendedService[] {
  const byService = new Map<RecommendedServiceType, Set<string>>();

  for (const finding of findings) {
    const services = FINDING_TITLE_TO_SERVICES[finding.title] ?? CATEGORY_TO_SERVICES[finding.category] ?? [];
    for (const service of services) {
      const triggers = byService.get(service) ?? new Set<string>();
      triggers.add(finding.title);
      byService.set(service, triggers);
    }
  }

  return Array.from(byService.entries())
    .map(([service, triggeredBy]) => ({ service, triggeredBy: Array.from(triggeredBy) }))
    .sort((a, b) => b.triggeredBy.length - a.triggeredBy.length || a.service.localeCompare(b.service));
}
