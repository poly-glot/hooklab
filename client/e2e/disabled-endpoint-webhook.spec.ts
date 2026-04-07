import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
  sendWebhook,
} from './fixtures/emulator-helpers';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

/**
 * Full disable/enable webhook rejection round-trip.
 * Extends coverage beyond endpoint-toggle-live.spec.ts by testing
 * the complete cycle: working -> disabled (404) -> re-enabled (200).
 */
test.describe('Disabled Endpoint Webhook Rejection', () => {
  test('full round-trip: active -> disabled (404) -> re-enabled (200)', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Rejection Round Trip');
    await navigateToEndpoint(page, 'Rejection Round Trip');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    // 1. Active endpoint accepts webhooks
    const res1 = await sendWebhook(endpointId);
    expect(res1.status).toBe(200);

    // 2. Disable via Live toggle
    const toggleButton = page.locator('.action-bar__live');
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    await toggleButton.click();
    await expect(toggleButton).toContainText('Off');

    // Wait for Firestore propagation
    await page.waitForTimeout(2000);

    // 3. Disabled endpoint rejects webhooks with 404
    const res2 = await sendWebhook(endpointId);
    expect(res2.status).toBe(404);

    // 4. Re-enable
    await toggleButton.click();
    await expect(toggleButton).toContainText('Live');
    await page.waitForTimeout(1000);

    // 5. Re-enabled endpoint accepts webhooks again
    const res3 = await sendWebhook(endpointId);
    expect(res3.status).toBe(200);
  });

  test('disabled endpoint via dashboard dropdown also rejects webhooks', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Dropdown Disable WH');
    await navigateToEndpoint(page, 'Dropdown Disable WH');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    // Confirm it works first
    const res1 = await sendWebhook(endpointId);
    expect(res1.status).toBe(200);

    // Go back to dashboard and disable via dropdown
    await page.getByTestId('back-button').click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    const card = page.locator('[data-testid="endpoint-card"]', { hasText: 'Dropdown Disable WH' }).first();
    await card.getByLabel('Options').click();
    await page.getByRole('menuitem', { name: 'Disable' }).click();
    await expect(card.getByText('Closed')).toBeVisible({ timeout: 5000 });

    // Wait for Firestore propagation
    await page.waitForTimeout(2000);

    // Should now reject
    const res2 = await sendWebhook(endpointId);
    expect(res2.status).toBe(404);
  });
});
