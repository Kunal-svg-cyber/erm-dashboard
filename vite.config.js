import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Exclude the e2e/ folder — those files use Playwright's test runner,
    // not Vitest's, and the two are not compatible in the same process.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
