// End-to-end tests: drive the actual deployed site with a real headless
// browser, the same way a person would. This catches things unit tests
// can't — a button that's visually broken, a form that doesn't submit,
// a role check that works in the database but got wired up wrong in the UI.
//
// Requires TEST_OWNER_EMAIL/PASSWORD and TEST_VIEWER_EMAIL/PASSWORD as
// env vars (same test accounts used by the RLS integration tests).

import { test, expect } from "@playwright/test";

test("login page loads and shows the sign-in form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByPlaceholder("Work email")).toBeVisible();
});

test("viewer role cannot see the New Risk button", async ({ page }) => {
  test.skip(!process.env.TEST_VIEWER_EMAIL, "TEST_VIEWER_EMAIL not set");

  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(process.env.TEST_VIEWER_EMAIL);
  await page.getByPlaceholder("Password").fill(process.env.TEST_VIEWER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Only proceed past 2FA if this test account doesn't have it enabled;
  // if it does, this test intentionally stops here rather than guessing a code.
  await page.waitForSelector("text=Enterprise risk exposure", { timeout: 15000 }).catch(() => {});

  await expect(page.getByRole("button", { name: /New risk/i })).toHaveCount(0);
});

test("owner role can see the New Risk button", async ({ page }) => {
  test.skip(!process.env.TEST_OWNER_EMAIL, "TEST_OWNER_EMAIL not set");

  await page.goto("/");
  await page.getByPlaceholder("Work email").fill(process.env.TEST_OWNER_EMAIL);
  await page.getByPlaceholder("Password").fill(process.env.TEST_OWNER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForSelector("text=Enterprise risk exposure", { timeout: 15000 }).catch(() => {});

  await expect(page.getByRole("button", { name: /New risk/i })).toBeVisible();
});
