import { describe, expect, it } from "vitest";
import { computeConversionAudit } from "./conversion-audit";
import { buildExtraction } from "./test-utils";

describe("computeConversionAudit", () => {
  it("scores 100 when every conversion signal is present", () => {
    const result = computeConversionAudit(buildExtraction());
    expect(result.score).toBe(100);
  });

  it("scores 0 for a site with no conversion paths at all", () => {
    const result = computeConversionAudit(
      buildExtraction({
        hasContactCta: false,
        phones: [],
        emails: [],
        bookingUrl: null,
        contactUrl: null,
        serviceInfo: [],
      }),
    );
    expect(result.score).toBe(0);
  });

  it("credits a booking link even without an explicit contact CTA", () => {
    const result = computeConversionAudit(
      buildExtraction({ hasContactCta: false, phones: [], emails: [], contactUrl: null, serviceInfo: [] }),
    );
    expect(result.breakdown.hasBookingCta).toBe(true);
    expect(result.score).toBe(20);
  });
});
