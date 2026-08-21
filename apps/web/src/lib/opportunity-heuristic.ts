import type { SearchResult } from "./lead-discovery-types";

export type OpportunityLevel = "HIGH" | "MEDIUM" | "LOW";

/**
 * A quick, explainable estimate from signals already on hand (no website,
 * no Google profile, weak rating/reviews) — not the real opportunity-scoring
 * engine (that's a later phase; see docs/roadmap.md). Used so the
 * "Opportunity" filter and card badge are genuinely functional today rather
 * than dead controls waiting on a module that doesn't exist yet.
 */
export function estimateOpportunity(result: SearchResult): OpportunityLevel {
  if (result.opportunityScore !== null) {
    if (result.opportunityScore >= 66) return "HIGH";
    if (result.opportunityScore >= 33) return "MEDIUM";
    return "LOW";
  }

  let points = 0;
  if (!result.hasWebsite) points += 2;
  if (!result.hasGoogleProfile) points += 1;
  if ((result.rating ?? 5) < 3.8) points += 1;
  if ((result.reviewCount ?? 999) < 20) points += 1;

  if (points >= 3) return "HIGH";
  if (points >= 1) return "MEDIUM";
  return "LOW";
}

export function opportunityBadgeVariant(
  level: OpportunityLevel,
): "default" | "secondary" | "outline" {
  if (level === "HIGH") return "default";
  if (level === "MEDIUM") return "secondary";
  return "outline";
}
