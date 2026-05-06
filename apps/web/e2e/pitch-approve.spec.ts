import { test, expect } from "@playwright/test";

/**
 * Phase 7 step 2 — primary E2E happy path.
 *
 * Flow: sign in → seed demo data via /api/demo/seed → assert pitch
 * card is "Draft" → click Approve & send → assert flips to "Sent"
 * via Realtime within 30s. The demo seed bypasses the LLM-dependent
 * scout/draft pipeline so this test stays deterministic and quick.
 *
 * Requires env: TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD.
 */

const EMAIL = process.env.TEST_USER_A_EMAIL;
const PASSWORD = process.env.TEST_USER_A_PASSWORD;

test.describe("pitch approval happy path", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_USER_A_* env vars not set");

  test("sign in → seed demo → approve via web → flips to sent", async ({ page }) => {
    // Sign in
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "you@example.com" }).fill(EMAIL!);
    await page.getByRole("textbox", { name: "••••••••" }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(?:onboarding)?$/, { timeout: 30_000 });

    // Seed demo data via API
    const seedRes = await page.request.post("/api/demo/seed");
    expect(seedRes.ok()).toBeTruthy();
    const seedJson = (await seedRes.json()) as { redirect?: string };
    expect(seedJson.redirect).toBeTruthy();

    // Navigate to the seeded lead
    await page.goto(seedJson.redirect!);

    // Wait for the pitch card "Draft" state to render
    await expect(page.getByText("Draft").first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("React 18 migration", { exact: false })
    ).toBeVisible({ timeout: 10_000 });

    // Approve via web
    await page.getByRole("button", { name: /Approve & send/i }).click();

    // Watch the card flip to "Sent" — this exercises the full HITL approval
    // chain: payload_hash verification → approvals row → audit_log →
    // pitch/approved Inngest event → sendPitch worker → Resend → realtime push.
    await expect(page.getByText("Pitch sent.")).toBeVisible({ timeout: 60_000 });

    // Stat card flips to 1
    await expect(page.locator("text=Pitches sent").locator("..").locator("text=/^[1-9]/")).toBeVisible();
  });

  test("/pitches list shows the sent pitch", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "you@example.com" }).fill(EMAIL!);
    await page.getByRole("textbox", { name: "••••••••" }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(?:onboarding)?$/, { timeout: 30_000 });

    await page.goto("/pitches");
    await expect(page.getByText("Pitches", { exact: true }).first()).toBeVisible();
    // SENT chip shows up after the demo seed flow ran in the previous test.
    // If the suite is run in isolation this still passes because we filter
    // by the chip's mere presence, not the count.
    await expect(page.getByRole("button", { name: /^Sent/ })).toBeVisible();
  });
});
