import { test, expect } from './fixtures/test-fixtures';

/**
 * Auth Page tests — runs against real Firebase Auth emulator.
 * A fresh browser context has no auth state, so visiting /auth shows
 * the login page naturally (no mock needed).
 */
test.describe('Auth Page - Authentication Journey', () => {
  test.describe('Unauthenticated User', () => {
    test.beforeEach(async ({ authPage }) => {
      await authPage.goto();
    });

    test('auth page loads with modal and all login options', async ({ authPage }) => {
      await authPage.expectLoaded();
      await expect(authPage.modalCard).toBeVisible();
      await expect(authPage.googleButton).toBeVisible();
      await expect(authPage.appleButton).toBeVisible();
      await expect(authPage.emailLinkButton).toBeVisible();
      await expect(authPage.guestButton).toBeVisible();
    });
  });

  test.describe('Coming Soon Features', () => {
    test.beforeEach(async ({ authPage }) => {
      await authPage.goto();
    });

    test('Email Link button shows Coming soon toast', async ({ authPage }) => {
      await authPage.clickEmailLink();
      await authPage.expectComingSoonToast();
    });
  });

  test.describe('Guest Login Flow', () => {
    test('clicking Continue as Guest triggers anonymous sign-in and redirects to dashboard', async ({
      page,
      authPage,
    }) => {
      await authPage.goto();
      await authPage.expectLoaded();
      await authPage.clickGuest();

      // Real Firebase Auth emulator processes signInAnonymously
      // On success, the app redirects to /dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
    });
  });

  test.describe('Auth Redirect Guards', () => {
    test('unauthenticated user accessing /dashboard gets redirected to /auth', async ({
      page,
    }) => {
      await page.goto('/dashboard');
      await page.waitForURL('**/auth', { timeout: 10000 });
      expect(page.url()).toContain('/auth');
    });

    test('unauthenticated user accessing /dashboard/endpoint/:id gets redirected', async ({
      page,
    }) => {
      await page.goto('/dashboard/endpoint/some-endpoint-id');
      await page.waitForURL('**/auth', { timeout: 10000 });
      expect(page.url()).toContain('/auth');
    });

    test('landing page is accessible without authentication', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL('/');
      await expect(page.locator('.lp-nav-logo')).toBeVisible();
    });
  });

});
