import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a local Supabase stack (`pnpm db:start`) and the web app.
 * The app must run with the local Supabase URL and keys (see e2e/README.md).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: process.env.CI ? "pnpm exec next start -p 3000 -H 127.0.0.1" : "pnpm exec next dev -p 3000 -H 127.0.0.1",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
