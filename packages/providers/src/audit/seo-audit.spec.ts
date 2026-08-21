import { describe, expect, it } from "vitest";
import { computeSeoAudit } from "./seo-audit";
import { buildExtraction } from "./test-utils";

describe("computeSeoAudit", () => {
  it("scores 100 when every SEO signal is present", () => {
    const result = computeSeoAudit(buildExtraction());
    expect(result.score).toBe(100);
    expect(result.breakdown.hasTitle).toBe(true);
  });

  it("scores only the not-blocked-by-robots floor when every other signal is absent", () => {
    // Absence of a robots meta tag is not itself an SEO problem — the site
    // just isn't explicitly blocking indexing — so that signal alone still credits.
    const result = computeSeoAudit(
      buildExtraction({
        title: null,
        metaDescription: null,
        h1: null,
        canonical: null,
        viewport: null,
        sitemapUrl: null,
        openGraph: {},
        structuredData: [],
        robotsMeta: null,
      }),
    );
    expect(result.score).toBe(10);
    expect(result.breakdown.notBlockedByRobots).toBe(true);
  });

  it("penalizes a noindex robots directive", () => {
    const result = computeSeoAudit(buildExtraction({ robotsMeta: "noindex, nofollow" }));
    expect(result.breakdown.notBlockedByRobots).toBe(false);
    expect(result.score).toBe(90);
  });

  it("is deterministic across repeated calls with identical input", () => {
    const extraction = buildExtraction();
    expect(computeSeoAudit(extraction)).toEqual(computeSeoAudit(extraction));
  });
});
