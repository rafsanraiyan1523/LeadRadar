import type {
  GoogleBusinessAuditResult,
  OpportunityLevel,
  OpportunityScoreBreakdown,
  OpportunityScoreResult,
} from "@lead-radar/types";

export interface OpportunityScoringInput {
  websiteScore: number | null;
  seoScore: number | null;
  mobileScore: number | null;
  conversionScore: number | null;
  technicalScore: number | null;
  contactabilityScore: number | null;
  googleProfile: GoogleBusinessAuditResult;
}

const DIGITAL_PILLAR_MAX = 60;
const LEGITIMACY_MAX = 40;

export function getOpportunityLevel(score: number): OpportunityLevel {
  if (score > 66) return "HIGH";
  if (score >= 33) return "MEDIUM";
  return "LOW";
}

/**
 * OpportunityScoringService's core formula: "is this a real, established
 * business (legitimacy) that a client would visibly benefit from helping
 * (digital weakness)?" A business with a great Google profile and NO
 * website scores high — established + wide open opportunity. A business
 * with an excellent website, strong SEO, and online booking scores low —
 * there's little room for us to help. See docs/scoring.md for the full
 * worked examples this formula is built against.
 *
 * Legitimacy (rating/reviews/operational status) is only ever drawn from a
 * FOUND, live-verified Google profile — never from an unverified snapshot —
 * so the score never rewards a business we can't actually confirm exists.
 */
export function computeOpportunityScore(input: OpportunityScoringInput): OpportunityScoreResult {
  const { googleProfile } = input;
  const verifiedSignals = googleProfile.status === "FOUND" ? googleProfile.signals : null;

  const ratingPoints = ratingScore(verifiedSignals?.rating ?? null);
  const reviewVolumePoints = reviewVolumeScore(verifiedSignals?.userRatingCount ?? null);
  const operationalPoints = verifiedSignals?.businessStatus === "OPERATIONAL" ? 10 : 0;
  const legitimacyTotal = ratingPoints + reviewVolumePoints + operationalPoints;

  const pillars = {
    websiteScore: input.websiteScore,
    seoScore: input.seoScore,
    mobileScore: input.mobileScore,
    conversionScore: input.conversionScore,
    technicalScore: input.technicalScore,
    contactabilityScore: input.contactabilityScore,
    googleProfileScore: googleProfile.score,
  };

  const digitalValues = [
    input.websiteScore,
    input.seoScore,
    input.mobileScore,
    input.conversionScore,
    input.technicalScore,
    input.contactabilityScore,
  ];
  // A missing sub-score (e.g. no website to audit) counts as its worst case
  // (0), not as excluded — "no website" IS the weakness being measured.
  const averageDigitalScore = Math.round(
    digitalValues.reduce((sum: number, v) => sum + (v ?? 0), 0) / digitalValues.length,
  );
  const weaknessPoints = Math.round(((100 - averageDigitalScore) / 100) * DIGITAL_PILLAR_MAX);

  const score = Math.max(0, Math.min(100, legitimacyTotal + weaknessPoints));

  const breakdown: OpportunityScoreBreakdown = {
    legitimacy: {
      ratingPoints,
      reviewVolumePoints,
      operationalPoints,
      total: legitimacyTotal,
    },
    digitalWeakness: {
      averageDigitalScore,
      points: weaknessPoints,
    },
    pillars,
  };

  return { score, level: getOpportunityLevel(score), breakdown };
}

function ratingScore(rating: number | null): number {
  if (rating === null) return 0;
  if (rating >= 4.5) return 15;
  if (rating >= 4) return 11;
  if (rating >= 3.5) return 7;
  if (rating >= 3) return 3;
  return 0;
}

function reviewVolumeScore(reviewCount: number | null): number {
  if (reviewCount === null) return 0;
  if (reviewCount >= 100) return 15;
  if (reviewCount >= 50) return 11;
  if (reviewCount >= 20) return 7;
  if (reviewCount >= 5) return 3;
  return 0;
}

export { LEGITIMACY_MAX, DIGITAL_PILLAR_MAX };
