/**
 * Browser tests: npm run test:e2e (first time on a machine: npx playwright install chromium).
 * Builds the app and serves it in demo mode on a fresh, temporary data folder, so tests
 * never touch your saved engagements or call Claude.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 8899);
const dataDir = path.join(os.tmpdir(), `volt-e2e-${Date.now()}`);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
    // A browser already on the machine (e.g. in CI images) can be used instead of Playwright's own.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "npm run build && node build/server/index.js",
    url: `http://127.0.0.1:${port}/api/healthz`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { NODE_ENV: "production", PORT: String(port), VOLT_DATA_DIR: dataDir, VOLT_MODE: "demo", VOLT_AUTO_RESUME: "off" },
  },
});
