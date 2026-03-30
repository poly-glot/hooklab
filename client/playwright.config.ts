import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';

/**
 * All E2E tests run against real Firebase emulators + Deno API server.
 *
 * Prerequisites (must be running before tests):
 *   - Firebase emulators: Auth (9099), Firestore (8080)
 *   - Deno API server: port 3000
 *   - Vite dev server: port 5174 (auto-started by webServer config below)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1512, height: 982 },
    actionTimeout: 15000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ui',
      testIgnore: /integration\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'integration',
      testMatch: /integration\//,
      // Integration tests share state via beforeAll (shared token).
      // Keep serial within each describe block.
      fullyParallel: false,
    },
  ],
  webServer: [
    {
      command: 'npx vite --host --mode development',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
