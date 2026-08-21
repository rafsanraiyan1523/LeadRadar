import type { GoogleBusinessAuditResult, GoogleBusinessSignals, GoogleProfileStatus } from "@lead-radar/types";

/**
 * Google Profile Score (0-100) from Places-permitted fields only — rating,
 * review volume, opening hours, phone, website. Only ever computed when the
 * profile is confirmed FOUND; callers must not score NOT_FOUND_IN_CURRENT_SEARCH
 * or UNVERIFIED profiles (see buildGoogleBusinessAuditResult). Weights sum to 100.
 */
export function computeGoogleProfileScore(signals: GoogleBusinessSignals): number {
  let score = 30; // Profile confirmed to exist at all.

  const rating = signals.rating ?? 0;
  if (rating >= 4.5) score += 20;
  else if (rating >= 4) score += 14;
  else if (rating >= 3) score += 7;

  const reviewCount = signals.userRatingCount ?? 0;
  if (reviewCount >= 100) score += 20;
  else if (reviewCount >= 50) score += 15;
  else if (reviewCount >= 10) score += 8;
  else if (reviewCount >= 1) score += 3;

  if (signals.openingHours && signals.openingHours.length > 0) score += 10;
  if (signals.phone) score += 10;
  if (signals.websiteUrl) score += 10;

  return Math.min(100, score);
}

/**
 * Assembles the GoogleBusinessAuditService's result from a live lookup
 * outcome. Never claims NOT_FOUND unless a real lookup against the
 * permitted Places data genuinely came back empty — a lookup that was never
 * attempted (no place id on file) or that failed (timeout/error) is always
 * UNVERIFIED, not a confident "no profile."
 */
export function buildGoogleBusinessAuditResult(input: {
  status: GoogleProfileStatus;
  signals: GoogleBusinessSignals | null;
  reason: string | null;
}): GoogleBusinessAuditResult {
  if (input.status !== "FOUND" || !input.signals) {
    return { status: input.status, score: null, signals: input.signals, reason: input.reason };
  }
  return {
    status: "FOUND",
    score: computeGoogleProfileScore(input.signals),
    signals: input.signals,
    reason: null,
  };
}
