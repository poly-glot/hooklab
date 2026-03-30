import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
  sendWebhook,
} from './fixtures/emulator-helpers';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

/**
 * Endpoint Detail page tests — runs against real Firebase emulators.
 * Creates real endpoints and sends real webhook requests to populate logs.
 */
test.describe('Endpoint Detail Page', () => {
  test.describe('Layout and Structure', () => {
    test('endpoint detail page loads with all key UI elements', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Layout Test');
      await navigateToEndpoint(page, 'Layout Test');

      await endpointDetailPage.expectLoaded();
      await expect(endpointDetailPage.backButton).toBeVisible();
      await expect(endpointDetailPage.editButton).toBeVisible();
      await expect(endpointDetailPage.copyButton).toBeVisible();
      await expect(endpointDetailPage.autoRefreshToggle).toBeVisible();
      await expect(endpointDetailPage.deleteAllButton).toBeVisible();
      await expect(endpointDetailPage.headerTab).toBeVisible();
      await expect(endpointDetailPage.bodyTab).toBeVisible();
      await expect(endpointDetailPage.queryTab).toBeVisible();
      await expect(endpointDetailPage.responseTab).toBeVisible();
      await expect(page.locator('.action-bar__toolbar-url').filter({ hasText: '/w/' })).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('Back to listing navigates to dashboard', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Nav Test Endpoint');
      await navigateToEndpoint(page, 'Nav Test Endpoint');

      await endpointDetailPage.clickBack();
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('Request List Sidebar', () => {
    test('shows request list items when requests exist', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Sidebar Requests');
      await navigateToEndpoint(page, 'Sidebar Requests');

      const endpointId = getEndpointIdFromUrl(page);
      await sendWebhook(endpointId);
      await sendWebhook(endpointId);

      const requestList = page.locator('[data-testid="request-list"]');
      await expect(
        requestList.locator('[role="button"]')
      ).toHaveCount(2, { timeout: 10000 });
    });

    test('shows waiting state when no requests exist', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Empty Sidebar');
      await navigateToEndpoint(page, 'Empty Sidebar');

      await expect(endpointDetailPage.noRequestsText).toBeVisible();
      await expect(
        page.getByText('Send a request to your webhook URL to see it here.')
      ).toBeVisible();
    });

    test('shows waiting state in content area when no requests exist', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Waiting State');
      await navigateToEndpoint(page, 'Waiting State');

      await expect(page.getByText('Waiting for first webhook...').first()).toBeVisible();
    });

    test('DELETE ALL button is disabled when no requests', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Disabled Delete');
      await navigateToEndpoint(page, 'Disabled Delete');

      await expect(endpointDetailPage.deleteAllButton).toBeDisabled();
    });

    test('DELETE ALL button is enabled when requests exist', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Enabled Delete');
      await navigateToEndpoint(page, 'Enabled Delete');

      const endpointId = getEndpointIdFromUrl(page);
      await sendWebhook(endpointId);

      const requestList = page.locator('[data-testid="request-list"]');
      await expect(
        requestList.locator('[role="button"]').first()
      ).toBeVisible({ timeout: 10000 });

      await expect(endpointDetailPage.deleteAllButton).toBeEnabled();
    });

    test('request items show method badge', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Method Badge');
      await navigateToEndpoint(page, 'Method Badge');

      const endpointId = getEndpointIdFromUrl(page);
      await sendWebhook(endpointId, { method: 'POST' });
      await sendWebhook(endpointId, { method: 'GET' });

      const requestList = page.locator('[data-testid="request-list"]');
      await expect(
        requestList.locator('[role="button"]')
      ).toHaveCount(2, { timeout: 10000 });

      await expect(page.getByText('POST').first()).toBeVisible();
      await expect(page.getByText('GET').first()).toBeVisible();
    });
  });

  test.describe('Tab Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Tab Test');
      await navigateToEndpoint(page, 'Tab Test');

      const endpointId = getEndpointIdFromUrl(page);
      await sendWebhook(endpointId, {
        method: 'POST',
        body: JSON.stringify({ event: 'payment.success', amount: 2500 }),
        query: { debug: 'true' },
      });

      const requestList = page.locator('[data-testid="request-list"]');
      await expect(
        requestList.locator('[role="button"]').first()
      ).toBeVisible({ timeout: 10000 });

      // Select the first request
      await requestList.locator('[role="button"]').first().click();
    });

    test('tabs switch content area correctly', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickBodyTab();
      await endpointDetailPage.expectBodyContent('payment.success');

      await endpointDetailPage.clickQueryTab();
      await endpointDetailPage.expectQueryParam('debug', 'true');

      await endpointDetailPage.clickResponseTab();
      await endpointDetailPage.expectResponseStatus('200');

      await endpointDetailPage.clickHeaderTab();
      await endpointDetailPage.expectHeaderTabContent();
    });
  });

  test.describe('Delete All Requests Dialog', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Delete All');
      await navigateToEndpoint(page, 'Delete All');

      const endpointId = getEndpointIdFromUrl(page);
      await sendWebhook(endpointId);

      const requestList = page.locator('[data-testid="request-list"]');
      await expect(
        requestList.locator('[role="button"]').first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('DELETE ALL opens confirmation dialog', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickDeleteAll();
      await expect(endpointDetailPage.clearDialogTitle).toBeVisible();
    });

    test('confirmation dialog shows warning text', async ({ endpointDetailPage, page }) => {
      await endpointDetailPage.clickDeleteAll();
      await expect(
        page.getByText('This will permanently delete all request logs')
      ).toBeVisible();
      await expect(page.getByText('This action cannot be undone')).toBeVisible();
    });

    test('Cancel button closes the dialog', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickDeleteAll();
      await expect(endpointDetailPage.clearDialogTitle).toBeVisible();

      await endpointDetailPage.cancelDeleteAll();
      await expect(endpointDetailPage.clearDialogTitle).not.toBeVisible();
    });

  });

  test.describe('Endpoint Not Found', () => {
    test('shows not found state for nonexistent endpoint', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await page.goto('/dashboard/endpoint/nonexistent-endpoint-id');
      await page.waitForLoadState('domcontentloaded');

      await expect(endpointDetailPage.notFoundText).toBeVisible();
      await expect(endpointDetailPage.backToDashboardButton).toBeVisible();
    });

    test('Back to Dashboard button navigates to dashboard', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await page.goto('/dashboard/endpoint/nonexistent-endpoint-id');
      await page.waitForLoadState('domcontentloaded');

      await endpointDetailPage.backToDashboardButton.click();
      await expect(page).toHaveURL('/dashboard');
    });
  });

  test.describe('URL Toolbar', () => {
    test('webhook URL contains endpoint ID', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'URL Toolbar');
      await navigateToEndpoint(page, 'URL Toolbar');

      const endpointId = getEndpointIdFromUrl(page);
      await expect(
        page.locator('.action-bar__toolbar-url', { hasText: endpointId })
      ).toBeVisible();
    });
  });
});
