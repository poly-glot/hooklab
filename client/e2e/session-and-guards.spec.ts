import { test, expect } from './fixtures/test-fixtures';
import { loginAsGuest } from './fixtures/emulator-helpers';

/**
 * Session persistence and route guard tests.
 * Verifies protected routes redirect unauthenticated users,
 * authenticated users skip /auth, and sessions survive reload.
 */
test.describe('Session and Route Guards', () => {
  test('protected route redirects to /auth when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/auth', { timeout: 10000 });
    expect(page.url()).toContain('/auth');
  });

  test('nested protected route redirects to /auth', async ({ page }) => {
    await page.goto('/dashboard/endpoint/some-fake-id');
    await page.waitForURL('**/auth', { timeout: 10000 });
    expect(page.url()).toContain('/auth');
  });

  test('/auth redirects to /dashboard when already authenticated', async ({ page }) => {
    await loginAsGuest(page);

    // Now navigate to /auth explicitly
    await page.goto('/auth');

    // Should redirect back to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('session survives page reload', async ({ page, dashboardPage }) => {
    await loginAsGuest(page);

    // Verify we're on dashboard
    await expect(dashboardPage.addNewButton).toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();

    // Should stay on dashboard (not redirect to /auth)
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(dashboardPage.addNewButton).toBeVisible({ timeout: 15000 });
  });

  test('logout redirects and clears session', async ({ page }) => {
    await loginAsGuest(page);

    // Header has a "Sign out" button with aria-label
    const signOutBtn = page.getByRole('button', { name: 'Sign out' });
    await expect(signOutBtn).toBeVisible({ timeout: 10000 });
    await signOutBtn.click();

    // Should redirect to / or /auth
    await page.waitForURL(/\/(auth)?$/, { timeout: 10000 });

    // Verify we can't access dashboard anymore
    await page.goto('/dashboard');
    await page.waitForURL('**/auth', { timeout: 10000 });
  });
});
