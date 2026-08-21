import { expect, test } from "@playwright/test";

/**
 * The golden path named in docs/roadmap.md's Phase 6 sequencing notes:
 * search → save → score → outreach → pipeline. Runs against the real dev
 * stack (mock lead-discovery + mock AI providers — the zero-cost defaults,
 * see docs/ai.md — so this needs no API keys), driving the actual browser
 * UI rather than calling the API directly, so it exercises the same code
 * path a real user does.
 */
test.describe("golden path: search → save → score → outreach → pipeline", () => {
  test("a lead can be discovered, saved, scored, messaged, and moved through the pipeline", async ({
    page,
  }) => {
    const email = `golden-path-${Date.now()}@example.com`;
    let businessName = "";

    await test.step("register", async () => {
      await page.goto("/register");
      await page.fill('input[name="name"]', "Golden Path");
      await page.fill('input[name="organizationName"]', "Golden Path Org");
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', "correct-horse-1");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/app/, { timeout: 15_000 });
    });

    await test.step("search", async () => {
      await page.goto("/app/find");
      await page.fill("#find-query", "Dental Clinic");
      await page.fill("#find-location", "Banani, Dhaka");
      await page.click('button[type="submit"]');
      await expect(page.getByText(/\d+ of \d+ results/)).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("save", async () => {
      const firstCard = page.locator('[role="button"]').filter({ hasText: "Save" }).first();
      businessName = ((await firstCard.locator("p").first().textContent()) ?? "").trim();
      expect(businessName.length).toBeGreaterThan(0);

      await firstCard.getByRole("button", { name: "Save", exact: true }).click();
      // The card's own button flips to a disabled "Saved" state once the
      // save round-trip completes — waiting on it (not a fixed sleep) is
      // what proves the lead actually landed in the CRM.
      await expect(
        firstCard.getByRole("button", { name: "Saved", exact: true }),
      ).toBeVisible({ timeout: 10_000 });
    });

    await test.step("score (run the digital intelligence audit)", async () => {
      await page.goto("/app/leads");
      await page.getByRole("button", { name: businessName }).first().click();
      await page.getByRole("link", { name: "Full audit" }).click();
      await page.waitForURL(/\/app\/leads\/.+/, { timeout: 15_000 });

      const enrichButton = page.getByRole("button", {
        name: /Run digital intelligence audit|Re-audit/,
      });
      if (await enrichButton.isVisible().catch(() => false)) {
        await enrichButton.click();
      }

      // Enrichment runs through a real BullMQ job in the worker — poll
      // (via an auto-retrying assertion, not a sleep) until a real
      // contactability score renders in the Overview section.
      await expect
        .poll(
          async () => {
            const text = await page.locator("body").innerText();
            return /Contactability[\s\S]{0,20}\d{1,3}\/100/.test(text);
          },
          { timeout: 60_000, message: "waiting for the audit to complete" },
        )
        .toBe(true);
    });

    await test.step("outreach (generate an AI message)", async () => {
      const generateButton = page.getByRole("button", { name: /Generate message/ });
      await generateButton.click();
      await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(/character/)).toBeVisible();
    });

    await test.step("pipeline (move the lead to Contacted)", async () => {
      await page.goto("/app/pipeline");
      // Lead cards render the business name as a paragraph inside a button,
      // not a heading — only the column labels ("New", "Contacted", ...) are
      // real headings.
      await expect(page.getByText(businessName).first()).toBeVisible({
        timeout: 10_000,
      });

      // Status changes here go through the same PATCH /leads/:id/status
      // used by drag-and-drop — using the Pipeline & CRM section's select
      // (opened via the card) is a stable way to exercise that persistence
      // without simulating a pointer drag gesture.
      await page.getByText(businessName).first().click();
      const statusSelect = page.getByRole("combobox").first();
      await statusSelect.click();
      await page.getByRole("option", { name: "Contacted", exact: true }).click();
      await page.keyboard.press("Escape");

      await page.reload();
      const contactedColumn = page.locator("div.flex.w-72.shrink-0", {
        has: page.locator("h3", { hasText: "Contacted" }),
      });
      await expect(contactedColumn.getByText(businessName)).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
