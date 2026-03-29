import { test as base, expect } from '@playwright/test';
import { LandingPage } from '../pages/landing.page';
import { AuthPage } from '../pages/auth.page';
import { DashboardPage } from '../pages/dashboard.page';
import { EndpointDetailPage } from '../pages/endpoint-detail.page';

/**
 * Extended test fixtures that include page objects for the app.
 *
 * All tests now run against real Firebase emulators (Auth, Firestore, Functions)
 * and the real Deno API server. No mocks — every interaction hits the real stack.
 */
type TestFixtures = {
  landingPage: LandingPage;
  authPage: AuthPage;
  dashboardPage: DashboardPage;
  endpointDetailPage: EndpointDetailPage;
};

export const test = base.extend<TestFixtures>({
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  endpointDetailPage: async ({ page }, use) => {
    await use(new EndpointDetailPage(page));
  },
});

export { expect };
