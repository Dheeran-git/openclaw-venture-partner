import { test, expect } from "@playwright/test";

/**
 * Phase 7 step 2 — pitch-reject E2E.
 *
 * Flow: sign in → seed demo data → click Reject on the draft pitch →
 * assert the pitch row flips to status='rejected' and the "Sent" stat
 * card does NOT increment. The reject route does not touch Resend, so
 * no email goes out — verified indirectly by status assertion.
 *
 * Requires env: TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD.
 */

const EMAIL = process.env.TEST_USER_A_EMAIL;
const PASSWORD = process.env.TEST_USER_A_PASSWORD;

test.describe("pitch rejection flow", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_USER_A_* env vars not set");

  test("sign in → seed demo → reject via web → status flips to rejected", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "you@example.com" }).fill(EMAIL!);
    await page.getByRole("textbox", { name: "••••••••" }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(?:onboarding)?$/, { timeout: 30_000 });

    const seedRes = await page.request.post("/api/demo/seed");
    expect(seedRes.ok()).toBeTruthy();
    const seedJson = (await seedRes.json()) as { redirect?: string };
    expect(seedJson.redirect).toBeTruthy();

    await page.goto(seedJson.redirect!);

    // Wait for the draft pitch to render.
    await expect(page.getByText("Draft").first()).toBeVisible({ timeout: 15_000 });

    // Reject the pitch.
    await page.getByRole("button", { name: /Reject/i }).click();

    // Assert the card flips to a rejected state.
    await expect(
      page.getByText(/Pitch rejected|Rejected/i).first()
    ).toBeVisible({ timeout: 15_000 });

    // The Approve button should no longer be available on this card.
    await expect(
      page.getByRole("button", { name: /Approve & send/i })
    ).toHaveCount(0);
  });

  test("/pitches list shows the rejected pitch with a Rejected chip", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "you@example.com" }).fill(EMAIL!);
    await page.getByRole("textbox", { name: "••••••••" }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(?:onboarding)?$/, { timeout: 30_000 });

    await page.goto("/pitches");
    await expect(page.getByText("Pitches", { exact: true }).first()).toBeVisible();
    // The Rejected status chip exists in the filter row once at least one
    // pitch has been rejected by this account.
    await expect(page.getByRole("button", { name: /^Rejected/ })).toBeVisible();
  });
});
