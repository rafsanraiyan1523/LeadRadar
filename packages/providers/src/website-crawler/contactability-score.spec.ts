import { describe, expect, it } from "vitest";
import { calculateContactabilityScore } from "./contactability-score";
import type { ContactabilitySignals } from "@lead-radar/types";

const NO_SIGNALS: ContactabilitySignals = {
  hasPhone: false,
  hasEmail: false,
  hasWebsite: false,
  hasFacebook: false,
  hasInstagram: false,
  hasLinkedIn: false,
  hasBookingUrl: false,
  hasContactPage: false,
  hasContactCta: false,
};

describe("calculateContactabilityScore", () => {
  it("scores 0 when no signal is present", () => {
    expect(calculateContactabilityScore(NO_SIGNALS).score).toBe(0);
  });

  it("scores 100 when every signal is present", () => {
    const all: ContactabilitySignals = {
      hasPhone: true,
      hasEmail: true,
      hasWebsite: true,
      hasFacebook: true,
      hasInstagram: true,
      hasLinkedIn: true,
      hasBookingUrl: true,
      hasContactPage: true,
      hasContactCta: true,
    };
    expect(calculateContactabilityScore(all).score).toBe(100);
  });

  it("scores phone + email + website higher than social alone", () => {
    const coreOnly = calculateContactabilityScore({ ...NO_SIGNALS, hasPhone: true, hasEmail: true, hasWebsite: true });
    const socialOnly = calculateContactabilityScore({ ...NO_SIGNALS, hasFacebook: true, hasInstagram: true, hasLinkedIn: true });
    expect(coreOnly.score).toBeGreaterThan(socialOnly.score);
  });

  it("returns a breakdown that mirrors the input signals exactly", () => {
    const signals = { ...NO_SIGNALS, hasEmail: true, hasBookingUrl: true };
    const { breakdown } = calculateContactabilityScore(signals);
    expect(breakdown).toEqual(signals);
  });
});
