import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://erm-dashboard-six.vercel.app",
    screenshot: "only-on-failure",
  },
});
