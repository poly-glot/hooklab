import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
  sendWebhook,
} from './fixtures/emulator-helpers';

/**
 * Live auto-refresh tests — verifies the Live toggle's polling behavior.
 * When Live is ON (default), new webhooks appear automatically via polling.
 * When Live is OFF, webhooks do NOT appear until toggled back ON.
 */
test.describe('Live Auto-Refresh', () => {
  test('Live ON — new webhooks appear without page interaction', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Live Poll Test');
    await navigateToEndpoint(page, 'Live Poll Test');

    // Verify Live toggle is ON by default
    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    await expect(toggleButton).toContainText('Live');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    // Wait for endpoint to propagate to Firestore (server reads via REST)
    await page.waitForTimeout(1000);

    // Send 2 webhooks from test (not from UI)
    await sendWebhook(endpointId, { body: JSON.stringify({ test: 1 }) });
    await sendWebhook(endpointId, { body: JSON.stringify({ test: 2 }) });

    // Requests should appear via polling (3s interval) without user action
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(
      requestList.locator('[role="button"]')
    ).toHaveCount(2, { timeout: 15000 });

    // Send one more
    await sendWebhook(endpointId, { body: JSON.stringify({ test: 3 }) });

    // Should reach 3 within the next poll cycle
    await expect(
      requestList.locator('[role="button"]')
    ).toHaveCount(3, { timeout: 10000 });
  });

  test('Live OFF — disables endpoint (webhooks return 404)', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Live Off Test');
    await navigateToEndpoint(page, 'Live Off Test');

    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    const endpointId = getEndpointIdFromUrl(page);

    // Confirm endpoint works while Live
    const res1 = await sendWebhook(endpointId);
    expect(res1.status).toBe(200);

    // Toggle Live OFF — this disables the endpoint
    await toggleButton.click();
    await expect(toggleButton).toContainText('Off');
    await page.waitForTimeout(2000);

    // Webhooks should be rejected
    const res2 = await sendWebhook(endpointId);
    expect(res2.status).toBe(404);

    // No new requests should appear in sidebar
    const requestList = page.locator('[data-testid="request-list"]');
    // The one successful request from before should be visible
    await expect(
      requestList.locator('[role="button"]')
    ).toHaveCount(1, { timeout: 10000 });

    // Toggle back ON — re-enables
    await toggleButton.click();
    await expect(toggleButton).toContainText('Live');
    await page.waitForTimeout(1000);

    const res3 = await sendWebhook(endpointId);
    expect(res3.status).toBe(200);

    // New request should appear
    await expect(
      requestList.locator('[role="button"]')
    ).toHaveCount(2, { timeout: 10000 });
  });

  test('REFRESH button fetches latest requests', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Refresh Btn Test');
    await navigateToEndpoint(page, 'Refresh Btn Test');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    // Send a webhook while Live is ON
    await sendWebhook(endpointId, { body: JSON.stringify({ refresh: true }) });

    // Wait for it to appear via auto-refresh
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(
      requestList.locator('[role="button"]')
    ).toHaveCount(1, { timeout: 15000 });

    // Send another webhook
    await sendWebhook(endpointId, { body: JSON.stringify({ refresh: 2 }) });

    // Click REFRESH to get it immediately instead of waiting for poll
    const refreshBtn = page.getByRole('button', { name: /REFRESH/i });
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });
    await refreshBtn.click();

    // Should now have 2 requests
    await expect(
      requestList.locator('[role="button"]')
    ).toHaveCount(2, { timeout: 10000 });
  });
});
