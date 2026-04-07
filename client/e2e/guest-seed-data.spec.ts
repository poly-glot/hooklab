import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  navigateToEndpoint,
} from './fixtures/emulator-helpers';

/**
 * Guest seed data tests — verifies that guest login seeds 6 demo endpoints
 * with execution logs, and that seed is idempotent on refresh.
 */
test.describe('Guest Seed Data', () => {
  const SEEDED_ENDPOINTS = [
    'Payment Webhooks',
    'Order Notifications',
    'User Signups',
    'Stripe Events',
    'GitHub Push Events',
    'Slack Alerts',
  ];

  test('guest login seeds 6 demo endpoints', async ({ page, dashboardPage }) => {
    await loginAsGuest(page);

    // Poll for 6 cards — seed is fire-and-forget, may take a few seconds
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 20000 });

    // Verify each endpoint name is visible
    for (const name of SEEDED_ENDPOINTS) {
      await expect(page.getByText(name, { exact: false })).toBeVisible();
    }
  });

  test('seeded endpoints show Active status', async ({ page }) => {
    await loginAsGuest(page);

    // Wait for all 6 cards
    const cards = page.locator('[data-testid="endpoint-card"]');
    await expect(cards).toHaveCount(6, { timeout: 20000 });

    // Each card should show Active status
    for (let i = 0; i < 6; i++) {
      await expect(cards.nth(i).getByText('Active')).toBeVisible();
    }
  });

  test('seeded endpoints have execution logs', async ({ page }) => {
    await loginAsGuest(page);

    // Wait for seed to complete
    const cards = page.locator('[data-testid="endpoint-card"]');
    await expect(cards).toHaveCount(6, { timeout: 20000 });

    // Click first endpoint card
    await navigateToEndpoint(page, SEEDED_ENDPOINTS[0]);

    // Sidebar request list should have at least 1 item
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(
      requestList.locator('[role="button"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('seed is idempotent — refresh does not duplicate data', async ({
    page,
    dashboardPage,
  }) => {
    await loginAsGuest(page);

    // Wait for 6 endpoints
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 20000 });

    // Reload the page
    await page.reload();

    // Wait for dashboard to load again
    await expect(dashboardPage.addNewButton).toBeVisible({ timeout: 15000 });

    // Should still be exactly 6 (not 12)
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 20000 });
  });
});
