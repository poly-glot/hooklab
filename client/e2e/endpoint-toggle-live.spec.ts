import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
} from './fixtures/emulator-helpers';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

test.describe('Live Toggle & Endpoint Disable', () => {
  test('new endpoint shows Live by default', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Live Default Test');
    await navigateToEndpoint(page, 'Live Default Test');

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    await expect(toggleButton).toHaveClass(/action-bar__live--on/);
    await expect(toggleButton).toContainText('Live');
  });

  test('clicking Live toggles to Off', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Toggle Off Test');
    await navigateToEndpoint(page, 'Toggle Off Test');

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    await expect(toggleButton).toContainText('Live');

    await toggleButton.click();

    await expect(toggleButton).toHaveClass(/action-bar__live--off/);
    await expect(toggleButton).toContainText('Off');
  });

  test('clicking Off toggles back to Live', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Toggle Back Test');
    await navigateToEndpoint(page, 'Toggle Back Test');

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Toggle off
    await toggleButton.click();
    await expect(toggleButton).toHaveClass(/action-bar__live--off/);
    await expect(toggleButton).toContainText('Off');

    // Toggle back on
    await toggleButton.click();
    await expect(toggleButton).toHaveClass(/action-bar__live--on/);
    await expect(toggleButton).toContainText('Live');
  });

  test('disabled endpoint rejects webhooks with 404', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Reject Webhook Test');
    await navigateToEndpoint(page, 'Reject Webhook Test');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Toggle to Off
    await toggleButton.click();
    await expect(toggleButton).toContainText('Off');

    // Wait for Firestore to propagate the change
    await page.waitForTimeout(2000);

    // Send a webhook request to the disabled endpoint
    const response = await fetch(`${API_BASE}/w/${endpointId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    expect(response.status).toBe(404);
  });

  test('re-enabled endpoint accepts webhooks', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Re-enable Webhook Test');
    await navigateToEndpoint(page, 'Re-enable Webhook Test');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Toggle off
    await toggleButton.click();
    await expect(toggleButton).toContainText('Off');

    // Toggle back on
    await toggleButton.click();
    await expect(toggleButton).toContainText('Live');

    // Wait for Firestore to propagate the change
    await page.waitForTimeout(1000);

    // Send a webhook request to the re-enabled endpoint
    const response = await fetch(`${API_BASE}/w/${endpointId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    expect(response.status).toBe(200);
  });

  test('Live toggle state persists after page reload', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Persist Reload Test');
    await navigateToEndpoint(page, 'Persist Reload Test');

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Toggle to Off
    await toggleButton.click();
    await expect(toggleButton).toContainText('Off');

    // Reload the page
    await page.reload();

    // Wait for the action bar to reappear
    const toggleAfterReload = page.locator('.action-bar__live');
    await expect(toggleAfterReload).toBeVisible({ timeout: 10000 });
    await expect(toggleAfterReload).toHaveClass(/action-bar__live--off/);
    await expect(toggleAfterReload).toContainText('Off');
  });

  test('disabled endpoint shows Off after navigating away and back', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Nav Away Test');
    await navigateToEndpoint(page, 'Nav Away Test');

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    // Toggle to Off
    await toggleButton.click();
    await expect(toggleButton).toContainText('Off');

    // Navigate back to the listing
    const backButton = page.getByText('Back to listing');
    await expect(backButton).toBeVisible({ timeout: 5000 });
    await backButton.click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate back to the same endpoint
    await navigateToEndpoint(page, 'Nav Away Test');

    // Verify the toggle still shows Off
    const toggleAfterNav = page.locator('.action-bar__live');
    await expect(toggleAfterNav).toBeVisible({ timeout: 10000 });
    await expect(toggleAfterNav).toHaveClass(/action-bar__live--off/);
    await expect(toggleAfterNav).toContainText('Off');
  });
});
