import { defineConfig, devices } from "@playwright/test";

// The frontend (docker compose) is published on the host at :3001.
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // MEDI-104: retry once on failure (e2e against a live stack is inherently
  // a little flaky — this is a scheduled smoke check, not a merge gate).
  retries: 1,
  // The journey is stateful (one patient, one backend), so run serially.
  workers: 1,
  fullyParallel: false,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
