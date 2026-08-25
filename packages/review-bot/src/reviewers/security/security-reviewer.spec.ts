import { describe, expect, it } from "vitest";
import { reviewSecurity } from "./security-reviewer";
import type { SecurityReviewInput } from "../shared/types";
import type { ChangeHunkSummary } from "../../explore/types";

function hunk(overrides: Partial<ChangeHunkSummary> & { excerpt: string }): ChangeHunkSummary {
  const base: ChangeHunkSummary = { header: "@@", startLine: 18, endLine: 21, truncated: false, addedLineNumbers: [], ...overrides };
  if (!overrides.addedLineNumbers) {
    const addedCount = base.excerpt.split("\n").filter((l) => l.startsWith("+")).length;
    base.addedLineNumbers = Array.from({ length: addedCount }, (_, i) => base.startLine + i);
  }
  return base;
}

function fileInput(path: string, hunks: ChangeHunkSummary[]): SecurityReviewInput {
  return { files: [{ path, changeKind: "modified", linesAdded: 4, linesRemoved: 1, hunks, changedSymbols: [] }] };
}

describe("reviewSecurity — hardcoded credential (DEFECT-3 shape)", () => {
  it("flags a credential-shaped literal introduced alongside a credential-named field", () => {
    const findings = reviewSecurity(
      fileInput("apps/worker/src/config/env.ts", [
        hunk({
          excerpt:
            "+  googlePlacesApiKey:\n" +
            "+    process.env.GOOGLE_MAPS_API_KEY ??\n" +
            "+    process.env.GOOGLE_PLACES_API_KEY ??\n" +
            '+    "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",',
        }),
      ]),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "security", severity: "MUST-FIX", confidence: "high" });
    expect(findings[0]?.evidence).toContain("AIzaSy");
  });

  it("does not flag a credential-shaped literal with no credential-named identifier nearby", () => {
    const findings = reviewSecurity(
      fileInput("src/fixtures.ts", [hunk({ excerpt: '+export const SAMPLE = "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000";' })]),
    );
    // No "apiKey/secret/token/..." keyword anywhere near it — not clearly representative of a credential.
    expect(findings).toEqual([]);
  });

  it("does not flag a credential-named field that only reads from process.env (no literal fallback)", () => {
    const findings = reviewSecurity(fileInput("src/config.ts", [hunk({ excerpt: "+  apiKey: process.env.API_KEY," })]));
    expect(findings).toEqual([]);
  });

  it("does not flag credential-shaped fixture values inside test files", () => {
    const findings = reviewSecurity(
      fileInput("src/config.spec.ts", [hunk({ excerpt: '+const apiKey = "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000";' })]),
    );
    expect(findings).toEqual([]);
  });
});

describe("reviewSecurity — missing guard on a new controller endpoint", () => {
  const controllerWithGuardedSiblings = [
    "import { Controller, Get, UseGuards } from '@nestjs/common';",
    "import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';",
    "",
    "@Controller('leads')",
    "export class LeadsController {",
    "  @UseGuards(JwtAuthGuard)",
    "  @Get()",
    "  list() {}",
    "",
    "  @Get(':id/export')",
    "  exportLead() {}",
    "}",
  ].join("\n");

  it("flags a new route method with no guard, when sibling methods are guarded and the class itself isn't", () => {
    const findings = reviewSecurity(
      fileInput("apps/api/src/leads/leads.controller.ts", [hunk({ excerpt: "+  @Get(':id/export')\n+  exportLead() {}" })]),
      (path) => (path === "apps/api/src/leads/leads.controller.ts" ? controllerWithGuardedSiblings : null),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ category: "security", severity: "MUST-FIX" });
  });

  it("does not flag when the new method itself carries @UseGuards", () => {
    const findings = reviewSecurity(
      fileInput("apps/api/src/leads/leads.controller.ts", [hunk({ excerpt: "+  @UseGuards(JwtAuthGuard)\n+  @Get(':id/export')\n+  exportLead() {}" })]),
      () => controllerWithGuardedSiblings,
    );
    expect(findings).toEqual([]);
  });

  it("does not flag when the class has a class-level @UseGuards (false-positive avoidance)", () => {
    const classGuarded = [
      "@Controller('leads')",
      "@UseGuards(JwtAuthGuard)",
      "export class LeadsController {",
      "  @Get(':id/export')",
      "  exportLead() {}",
      "}",
    ].join("\n");
    const findings = reviewSecurity(
      fileInput("apps/api/src/leads/leads.controller.ts", [hunk({ excerpt: "+  @Get(':id/export')\n+  exportLead() {}" })]),
      () => classGuarded,
    );
    expect(findings).toEqual([]);
  });

  it("does not flag when no sibling method has a guard either (controller may be intentionally public)", () => {
    const noGuardsAnywhere = ["@Controller('health')", "export class HealthController {", "  @Get()", "  check() {}", "}"].join("\n");
    const findings = reviewSecurity(
      fileInput("apps/api/src/health/health.controller.ts", [hunk({ excerpt: "+  @Get()\n+  check() {}" })]),
      () => noGuardsAnywhere,
    );
    expect(findings).toEqual([]);
  });

  it("does not flag non-controller files even with a route-shaped decorator string", () => {
    const findings = reviewSecurity(fileInput("src/routes-doc.ts", [hunk({ excerpt: "+  // @Get('/x') documented here" })]), () => "irrelevant");
    expect(findings).toEqual([]);
  });

  // Characterization test (added before the Step 10 refactor of
  // detectMissingGuardOnNewEndpoint — see docs/assignment/refactoring-notes.md):
  // no existing test above exercises a single hunk that introduces MORE
  // THAN ONE new route method at once. This locks in the detector's
  // current, real behavior for that shape, which the refactor is required
  // to preserve exactly (not fix): the "does the new method carry its own
  // guard" check tests the *whole hunk's* added text for any @UseGuards
  // occurrence, not the specific method that's missing one — so a hunk
  // adding two new methods, where only one is guarded, is NOT flagged,
  // even though the other one is a genuine unguarded endpoint. This is a
  // known, documented limitation (see refactoring-notes.md), not a defect
  // introduced by the refactor.
  it("[characterization] does not flag a hunk that adds two new methods together, one guarded and one not", () => {
    const findings = reviewSecurity(
      fileInput("apps/api/src/leads/leads.controller.ts", [
        hunk({
          excerpt:
            "+  @UseGuards(JwtAuthGuard)\n" +
            "+  @Get()\n" +
            "+  safeMethod() {}\n" +
            "+\n" +
            "+  @Get(':id/export')\n" +
            "+  exportLead() {}",
        }),
      ]),
      () => controllerWithGuardedSiblings,
    );
    expect(findings).toEqual([]);
  });
});

describe("reviewSecurity — general conservatism", () => {
  it("produces no findings for an unremarkable change", () => {
    const findings = reviewSecurity(fileInput("src/x.ts", [hunk({ excerpt: "+  const label = formatLabel(name);" })]));
    expect(findings).toEqual([]);
  });

  it("skips deleted files", () => {
    const findings = reviewSecurity({
      files: [{ path: "src/gone.ts", changeKind: "deleted", linesAdded: 0, linesRemoved: 5, hunks: [hunk({ excerpt: '-  apiKey: "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",' })], changedSymbols: [] }],
    });
    expect(findings).toEqual([]);
  });

  it("every finding includes all required rubric fields", () => {
    const findings = reviewSecurity(
      fileInput("apps/worker/src/config/env.ts", [hunk({ excerpt: '+  apiKey: "AIzaSyBENCHMARK0FAKE0KEY0DO0NOT0USE00000",' })]),
    );
    for (const field of ["category", "severity", "title", "file", "line", "explanation", "evidence", "suggested_fix", "confidence"]) {
      expect(findings[0]).toHaveProperty(field);
    }
  });
});
