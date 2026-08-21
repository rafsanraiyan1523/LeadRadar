import type { SearchResult } from "./lead-discovery-types";
import type { FindFilters } from "@/stores/find-filters-store";
import { estimateOpportunity } from "./opportunity-heuristic";

/**
 * Refines an already-fetched page of results by criteria the API doesn't
 * filter server-side (Google presence, the opportunity heuristic, and the
 * "additional" toggles) — minRating/hasWebsite go through the API instead.
 * See components/find/filters-bar.tsx for why only two "additional" toggles
 * exist: the rest (booking, SEO, generic "poor website") have no backing
 * signal until the website-audit module lands.
 */
export function applyClientFilters(results: SearchResult[], filters: FindFilters): SearchResult[] {
  return results.filter((result) => {
    if (filters.googlePresence === "FOUND" && !result.hasGoogleProfile) return false;
    if (filters.googlePresence === "NOT_VERIFIED" && result.hasGoogleProfile) return false;

    if (filters.opportunity !== "ANY" && estimateOpportunity(result) !== filters.opportunity)
      return false;

    if (filters.lowReviews && (result.reviewCount ?? 999) >= 20) return false;
    if (filters.weakDigitalPresence && (result.hasWebsite || result.hasGoogleProfile)) return false;

    return true;
  });
}
