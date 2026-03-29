import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const API_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * All E2E tests run against real Firebase emulators + Deno API server.
 *
 * Prerequisites (must be running before tests):
 *   - Firebase emulators: Auth (9099), Firestore (8080), Functions (5001)
 *   - Deno API server: port 3000
 *   - Vite dev server: port 5174 (auto-started by webServer config below)
 *
 * Start emulators + server:
 *   npm run serve  (from project root — starts Firebase emulators)
 *   cd server && deno task dev  (starts Deno API server)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
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
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
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
