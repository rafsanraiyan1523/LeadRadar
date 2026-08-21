import type { ContactabilityResult, ContactabilitySignals } from "@lead-radar/types";

// Weights sum to exactly 100.
const WEIGHTS: Record<keyof ContactabilitySignals, number> = {
  hasPhone: 20,
  hasEmail: 20,
  hasWebsite: 15,
  hasFacebook: 8,
  hasInstagram: 8,
  hasLinkedIn: 8,
  hasBookingUrl: 10,
  hasContactPage: 6,
  hasContactCta: 5,
};

export function calculateContactabilityScore(signals: ContactabilitySignals): ContactabilityResult {
  const breakdown = {} as Record<keyof ContactabilitySignals, boolean>;
  let score = 0;

  for (const key of Object.keys(WEIGHTS) as (keyof ContactabilitySignals)[]) {
    const present = signals[key];
    breakdown[key] = present;
    if (present) score += WEIGHTS[key];
  }

  return { score, breakdown };
}
