import { test, expect } from "@playwright/test";

/**
 * Phase 7 — the most important security test: payload_hash stale-draft 409.
 * If a malicious user (or a buggy client) approves a hash that no longer
 * matches the pitch in DB, the API must refuse. This protects against
 * "trick the operator into approving content they never saw."
 *
 * Mechanism: send approve with a deliberately-wrong payload_hash; expect 409.
 * Tests no UI — pure API contract.
 */

const EMAIL = process.env.TEST_USER_A_EMAIL;
const PASSWORD = process.env.TEST_USER_A_PASSWORD;

test.describe("payload_hash stale-draft 409 guard", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_USER_A_* env vars not set");

  test("approve with wrong payload_hash returns 409 stale_draft", async ({ page }) => {
    // Sign in to get a session cookie that authenticates subsequent API calls
    await page.goto("/auth/login");
    await page.getByRole("textbox", { name: "you@example.com" }).fill(EMAIL!);
    await page.getByRole("textbox", { name: "••••••••" }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(?:onboarding)?$/);

    // Seed demo so we have a pitch to approve
    const seed = await page.request.post("/api/demo/seed");
    expect(seed.ok()).toBeTruthy();
    const { pitch_id } = (await seed.json()) as { pitch_id: string };

    // Approve with a deliberately-wrong hash — must be 409
    const bad = await page.request.post(`/api/pitches/${pitch_id}/approve`, {
      data: { payload_hash: "0".repeat(64) },
    });
    expect(bad.status()).toBe(409);
    const json = (await bad.json()) as { error?: string };
    expect(json.error).toBe("stale_draft");
  });
});
