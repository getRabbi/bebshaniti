import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/uat",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.UAT_ADMIN_URL ?? "http://localhost:3000",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome-desktop",
      use: { channel: "chrome", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "edge-desktop",
      use: { channel: "msedge", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "chrome-mobile",
      use: {
        channel: "chrome",
        ...devices["Pixel 7"],
      },
    },
    {
      name: "edge-tablet",
      use: {
        channel: "msedge",
        viewport: { width: 820, height: 1180 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
