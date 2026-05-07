import { test, expect } from "@playwright/test";

/**
 * Phase 7 step 2 — sign up → onboarding → first scout → see leads.
 *
 * The full signup-confirmation cycle requires email round-tripping which
 * isn't viable in CI. To keep this spec deterministic, we use a dedicated
 * pre-confirmed but un-onboarded test user (TEST_FRESH_USER_*) and exercise
 * the onboarding + scout legs end-to-end. The sign-up *form* itself is
 * smoke-tested separately to make sure the route renders and the OAuth
 * buttons mount.
 *
 * Set TEST_FRESH_USER_* by:
 *   1. Run `pnpm supabase ... users create email --password ... --confirm`.
 *   2. Do NOT insert a row into profiles for this user — the test exercises
 *      onboarding which runs the upsert itself.
 *   3. Drop the user's leads/scores between runs if you want repeatable
 *      "first scout" behavior.
 */

const FRESH_EMAIL = process.env.TEST_FRESH_USER_EMAIL;
const FRESH_PASSWORD = process.env.TEST_FRESH_USER_PASSWORD;

test.describe("signup form smoke", () => {
  test("/auth/signup renders the form", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByRole("textbox", { name: "you@example.com" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "••••••••" })).toBeVisible();
    // GitHub OAuth button mounts (uses the lucide Github icon — accessible name).
    await expect(page.getByRole("button", { name: /github/i })).toBeVisible();
  });

  test("/auth/login renders the form and links to signup", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up|create.*account/i })).toBeVisible();
  });
});

test.describe("first-run end-to-end (signup → onboarding → scout → see leads)", () => {
  test.skip(!FRESH_EMAIL || !FRESH_PASSWORD, "TEST_FRESH_USER_* env vars not set");

  test("fresh user can complete onboarding and run a scout", async ({ page }) => {
    // Sign in as the fresh, un-onboarded user.
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "you@example.com" }).fill(FRESH_EMAIL!);
    await page.getByRole("textbox", { name: "••••••••" }).fill(FRESH_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Onboarding step 1 — profile.
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    await page.getByLabel(/display name/i).fill("E2E Test Operator");
    await page.getByRole("button", { name: /next|continue/i }).click();

    // Onboarding step 2 — skills + bio.
    await page.getByText("React", { exact: true }).click();
    await page.getByText("Next.js", { exact: true }).click();
    await page.getByText("TypeScript", { exact: true }).click();
    await page.getByPlaceholder(/Senior frontend engineer/i).fill(
      "E2E test operator profile — used by Phase 7 signup-scout spec."
    );
    await page.getByRole("button", { name: /next|continue/i }).click();

    // Onboarding step 3 — connect (optional). Finish without binding.
    await page.getByRole("button", { name: /finish|done|skip/i }).click();

    // Land on the inbox.
    await page.waitForURL(/\/$|\/(inbox)?$/, { timeout: 15_000 });

    // Run the first scout via the topbar query input + "Run scout" button.
    await page.locator("[data-scout-query]").fill("react next.js");
    await page.getByRole("button", { name: /run scout/i }).click();

    // Wait for at least one lead row to appear in the LeadTable. The stub
    // scraper returns 12 deterministic fixtures by default — first ones
    // should be visible within ~30s on cold start.
    await expect(
      page.locator("table tbody tr, [data-testid='lead-row']").first()
    ).toBeVisible({ timeout: 60_000 });
  });
});
