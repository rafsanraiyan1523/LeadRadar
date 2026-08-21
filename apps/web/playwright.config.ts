import { defineConfig, devices } from "@playwright/test";

/**
 * Golden-path e2e coverage (search → save → score → outreach → pipeline),
 * driven against a real browser and the real dev stack — not a mocked
 * fetch layer. This machine has no Docker (see docs/roadmap.md /
 * env-windows-toolchain-notes memory), so the stack comes up the same way
 * a developer brings it up locally: `pnpm dev:db` + `pnpm dev:redis`
 * (persistent embedded Postgres/Redis) + `pnpm dev` (web+api+worker).
 * `reuseExistingServer` means if that stack is already running (as it
 * normally is during development), Playwright just uses it — nothing is
 * started twice.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "pnpm dev:db",
      cwd: "../..",
      port: 5433,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "pnpm dev:redis",
      cwd: "../..",
      port: 6379,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Starts web+api+worker together (one logical unit — see root
      // package.json's `dev` script) — a single webServer entry, since two
      // entries sharing this command would each try to launch it
      // independently whenever neither's readiness check is satisfied yet,
      // double-starting the whole stack.
      command: "pnpm dev",
      cwd: "../..",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
