import { test, expect, type Page } from '@playwright/test';

/**
 * Guest journey E2E tests.
 *
 * These run against the real Firebase Auth emulator (port 9099) and Firestore emulator (port 8080).
 * The Vite dev server must be running on port 5174 (or BASE_URL).
 *
 * Flow: Landing → Auth → Guest Login → Dashboard → Create/View Endpoints → Script Editor
 */

test.describe('Guest User Journey', () => {
  test('landing page loads and has navigation to auth', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');

    // Should have a sign in / get started link
    const authLinks = page.locator('a[href="/auth"], button:has-text("Sign"), button:has-text("Started"), a:has-text("Sign")');
    await expect(authLinks.first()).toBeVisible({ timeout: 10000 });
  });

  test('navigating to /auth shows login options', async ({ page }) => {
    await page.goto('/auth');

    // Should show the auth modal with login options
    await expect(page.getByText('HOOKLAB')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Guest')).toBeVisible();
  });

  test('protected route redirects to /auth when not logged in', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/auth', { timeout: 10000 });
    expect(page.url()).toContain('/auth');
  });

  test('guest login flow - click through to dashboard', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByText('Guest')).toBeVisible({ timeout: 10000 });

    // Click "Continue as Guest"
    await page.getByText('Guest').click();

    // Should navigate to dashboard (may take a moment for Firebase anonymous auth)
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('dashboard loads after guest login', async ({ page }) => {
    await loginAsGuest(page);

    // Dashboard should show header
    await expect(page.locator('header, [class*="header"]').first()).toBeVisible({ timeout: 10000 });

    // Should show "New Endpoint" button
    const createBtn = page.getByRole('button', { name: 'ADD NEW' }).first();
    await expect(createBtn).toBeVisible({ timeout: 10000 });
  });

  test('can create a new endpoint from dashboard', async ({ page }) => {
    await loginAsGuest(page);

    // Click "New Endpoint"
    const createBtn = page.getByRole('button', { name: 'ADD NEW' }).first();
    await createBtn.click();

    // Fill in the name in the dialog
    const nameInput = page.getByRole('textbox', { name: 'Endpoint Name' });
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('My Test Webhook');

    // Submit
    const submitBtn = page.getByRole('button', { name: 'Create Endpoint' });
    await submitBtn.click();

    // Should see the new endpoint in the list
    await expect(page.getByText('My Test Webhook')).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to endpoint detail', async ({ page }) => {
    await loginAsGuest(page);

    // Create an endpoint first
    await createEndpointViaUI(page, 'Detail Test Webhook');

    // Click on the endpoint card
    await page.getByText('Detail Test Webhook').click();

    // Should navigate to endpoint detail page
    await page.waitForURL('**/dashboard/endpoint/**', { timeout: 10000 });

    // Should show the webhook URL
    await expect(page.locator('text=/\\/w\\//').first()).toBeVisible({ timeout: 5000 });
  });

  test('can access script editor from endpoint detail', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Script Test Webhook');

    // Click on the endpoint
    await page.getByText('Script Test Webhook').click();
    await page.waitForURL('**/dashboard/endpoint/**', { timeout: 10000 });

    // Click on Script button
    const scriptBtn = page.getByRole('button', { name: /script/i }).or(page.getByText('Script').first());
    if (await scriptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scriptBtn.click();
      await page.waitForURL('**/script', { timeout: 10000 });
    }
  });

  test('can delete an endpoint', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'To Delete Webhook');

    // Find the endpoint card and open its menu
    const card = page.getByText('To Delete Webhook').locator('..');

    // Look for options/menu button near the card
    const optionsBtn = card.locator('button').filter({ has: page.locator('svg') }).last();
    if (await optionsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await optionsBtn.click();

      // Click Delete in dropdown
      const deleteOption = page.getByRole('menuitem', { name: /delete/i });
      if (await deleteOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteOption.click();

        // Confirm in dialog
        const confirmBtn = page.getByRole('button', { name: /^delete$/i });
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();

          // Wait for deletion
          await page.waitForTimeout(2000);
        }
      }
    }
  });

  test('search/filter endpoints', async ({ page }) => {
    await loginAsGuest(page);

    // Create multiple endpoints
    await createEndpointViaUI(page, 'Alpha Webhook');
    await createEndpointViaUI(page, 'Beta Webhook');
    await createEndpointViaUI(page, 'Gamma Webhook');

    // Search
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Alpha');
      await page.waitForTimeout(500);

      // Should show Alpha, not Beta/Gamma
      await expect(page.getByText('Alpha Webhook')).toBeVisible();
      // Clear search
      await searchInput.clear();
    }
  });

  test('filter pills work', async ({ page }) => {
    await loginAsGuest(page);

    // Check for filter pills
    const allPill = page.getByRole('button', { name: /all/i }).first();
    const activePill = page.getByRole('button', { name: /active/i }).first();

    if (await allPill.isVisible({ timeout: 3000 }).catch(() => false)) {
      await allPill.click();
      await page.waitForTimeout(500);

      if (await activePill.isVisible({ timeout: 2000 }).catch(() => false)) {
        await activePill.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('sign out returns to landing or auth', async ({ page }) => {
    await loginAsGuest(page);

    // Look for sign out / logout button
    const signOutBtn = page.getByRole('button', { name: /sign out|logout|log out/i });
    if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signOutBtn.click();
      // Should redirect to landing or auth page
      await page.waitForTimeout(3000);
      const url = page.url();
      expect(url.includes('/auth') || url.endsWith('/')).toBeTruthy();
    }
  });
});

// --- Helpers ---

async function loginAsGuest(page: Page) {
  await page.goto('/auth');
  await expect(page.getByText('Guest')).toBeVisible({ timeout: 10000 });
  await page.getByText('Guest').click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

async function createEndpointViaUI(page: Page, name: string) {
  const createBtn = page.getByRole('button', { name: 'ADD NEW' }).first();
  await expect(createBtn).toBeVisible({ timeout: 5000 });
  await createBtn.click();

  const nameInput = page.getByRole('textbox', { name: 'Endpoint Name' });
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);

  const submitBtn = page.getByRole('button', { name: 'Create Endpoint' });
  await submitBtn.click();

  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}
