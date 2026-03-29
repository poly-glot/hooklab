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

    test('auth page loads with modal card visible', async ({ authPage }) => {
      await authPage.expectLoaded();
      await expect(authPage.modalCard).toBeVisible();
    });

    test('displays HOOKLAB title', async ({ authPage }) => {
      await expect(authPage.title).toBeVisible();
      await expect(authPage.title).toHaveText('HOOKLAB');
    });

    test('displays descriptive text about the platform', async ({ page }) => {
      await expect(
        page.getByText('Stop guessing what happens when an API fires', { exact: false })
      ).toBeVisible();
    });

    test('shows all authentication buttons', async ({ authPage }) => {
      await expect(authPage.googleButton).toBeVisible();
      await expect(authPage.appleButton).toBeVisible();
      await expect(authPage.emailLinkButton).toBeVisible();
      await expect(authPage.guestButton).toBeVisible();
    });

    test('Google button has correct text', async ({ authPage }) => {
      await expect(authPage.googleButton).toContainText('Continue with Google');
    });

    test('Email Link button has correct text', async ({ authPage }) => {
      await expect(authPage.emailLinkButton).toContainText('Continue with Email Link');
    });

    test('Guest button has correct text', async ({ authPage }) => {
      await expect(authPage.guestButton).toContainText('Continue as');
      await expect(authPage.page.getByText('Guest')).toBeVisible();
    });

    test('blurred background dashboard mock is visible', async ({ authPage }) => {
      await expect(authPage.blurredBackground).toBeVisible();
    });

    test('description highlights test, record, and replay keywords', async ({ page }) => {
      const strongElements = page.locator('.auth-page__modal strong');
      const texts = await strongElements.allTextContents();
      expect(texts).toContain('test');
      expect(texts).toContain('record');
      expect(texts).toContain('replay');
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

  test.describe('Auth Page UI Details', () => {
    test.beforeEach(async ({ authPage }) => {
      await authPage.goto();
    });

    test('auth buttons have Google and Email icons', async ({ page }) => {
      const googleSvg = page.getByRole('button', { name: /Google/i }).locator('svg');
      await expect(googleSvg).toBeVisible();

      const emailSvg = page.getByRole('button', { name: /Email/i }).locator('svg');
      await expect(emailSvg).toBeVisible();
    });

    test('modal card has proper width constraint', async ({ authPage }) => {
      const box = await authPage.modalCard.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(500);
      expect(box!.width).toBeGreaterThan(300);
    });

    test('overlay/backdrop is present behind modal', async ({ page }) => {
      const overlay = page.locator('.auth-page__overlay');
      await expect(overlay).toBeVisible();
    });

    test('buttons are stacked vertically in a column', async ({ page }) => {
      const googleBox = await page
        .getByRole('button', { name: /Google/i })
        .boundingBox();
      const emailBox = await page
        .getByRole('button', { name: /Email/i })
        .boundingBox();

      expect(googleBox).not.toBeNull();
      expect(emailBox).not.toBeNull();

      expect(emailBox!.y).toBeGreaterThan(googleBox!.y);
    });
  });
});
