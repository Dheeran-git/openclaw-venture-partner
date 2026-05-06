import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — runs against the live Vercel preview by default,
 * or set BASE_URL to point at a local dev server (`pnpm --filter web dev`).
 *
 * Sign-in credentials come from TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD
 * env vars (already populated on Vercel for the auth-isolation test).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.BASE_URL ?? "https://openclaw-venture-partner-web.vercel.app",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
  ],
});
