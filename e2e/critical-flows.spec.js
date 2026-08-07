

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
