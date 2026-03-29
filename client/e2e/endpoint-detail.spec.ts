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
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Payment Webhooks');
      await navigateToEndpoint(page, 'Payment Webhooks');

      const endpointId = getEndpointIdFromUrl(page);

      // Send real webhook requests to populate request logs
      await sendWebhook(endpointId, {
        method: 'POST',
        body: JSON.stringify({ event: 'payment.success', amount: 2500, currency: 'usd' }),
        headers: { 'stripe-signature': 'sig_test_abc123' },
        query: { debug: 'true' },
      });
      await sendWebhook(endpointId, {
        method: 'GET',
        query: { ping: 'true' },
      });

      // Wait for real-time listener to pick up requests
      const requestList = page.locator('[data-testid="request-list"]');
      await expect(
        requestList.locator('[role="button"]').first()
      ).toBeVisible({ timeout: 10000 });
    });

    test('endpoint detail page loads with header', async ({ endpointDetailPage }) => {
      await endpointDetailPage.expectLoaded();
    });

    test('header displays Hooklab branding', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.headerLogo).toBeVisible();
      await expect(endpointDetailPage.headerLogo).toHaveText('Hooklab');
    });

    test('Back to listing button is visible', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.backButton).toBeVisible();
    });

    test('webhook URL is displayed in toolbar', async ({ page }) => {
      await expect(page.locator('.action-bar__toolbar-url').filter({ hasText: '/w/' })).toBeVisible();
    });

    test('Copy button is visible', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.copyButton).toBeVisible();
    });

    test('Edit button is visible on desktop', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.editButton).toBeVisible();
    });

    test('Auto refresh toggle is visible', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.autoRefreshToggle).toBeVisible();
    });

    test('DELETE ALL button is visible in sidebar', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.deleteAllButton).toBeVisible();
    });

    test('DELETE ALL button has danger color', async ({ endpointDetailPage }) => {
      const bgColor = await endpointDetailPage.deleteAllButton.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      expect(bgColor).toBe('rgb(172, 27, 17)');
    });

    test('footer displays copyright notice', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.copyrightText).toBeVisible();
    });

    test('all four tabs are visible', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.headerTab).toBeVisible();
      await expect(endpointDetailPage.bodyTab).toBeVisible();
      await expect(endpointDetailPage.queryTab).toBeVisible();
      await expect(endpointDetailPage.responseTab).toBeVisible();
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

    test('Header tab shows request metadata', async ({ page }) => {
      await expect(page.getByText('Host')).toBeVisible();
      await expect(page.getByText('Method')).toBeVisible();
    });

    test('clicking Body tab shows request body', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickBodyTab();
      await endpointDetailPage.expectBodyContent('payment.success');
    });

    test('Body tab shows pretty-printed JSON', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickBodyTab();
      await endpointDetailPage.expectBodyContent('event');
      await endpointDetailPage.expectBodyContent('amount');
    });

    test('clicking Query tab shows query parameters', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickQueryTab();
      await endpointDetailPage.expectQueryParam('debug', 'true');
    });

    test('clicking Response tab shows status code', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickResponseTab();
      await endpointDetailPage.expectResponseStatus('200');
    });

    test('Response tab shows response body', async ({ endpointDetailPage, page }) => {
      await endpointDetailPage.clickResponseTab();
      await expect(page.getByText('Response Body')).toBeVisible();
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

  test.describe('Auto Refresh Toggle', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Auto Refresh');
      await navigateToEndpoint(page, 'Auto Refresh');
    });

    test('auto refresh toggle shows Live text', async ({ endpointDetailPage }) => {
      await expect(endpointDetailPage.autoRefreshToggle).toContainText('Live');
    });

    test('clicking auto refresh toggles visual state', async ({ endpointDetailPage }) => {
      const initialClasses = await endpointDetailPage.autoRefreshToggle.getAttribute('class');
      expect(initialClasses).toContain('action-bar__live--on');

      await endpointDetailPage.toggleAutoRefresh();

      const toggledClasses = await endpointDetailPage.autoRefreshToggle.getAttribute('class');
      expect(toggledClasses).toContain('action-bar__live--off');
    });

    test('auto refresh toggle changes dot color', async ({ endpointDetailPage }) => {
      const dotOn = endpointDetailPage.page.locator('.action-bar__live-dot--on');
      await expect(dotOn).toBeVisible();

      await endpointDetailPage.toggleAutoRefresh();

      const dotOff = endpointDetailPage.page.locator('.action-bar__live-dot--off');
      await expect(dotOff).toBeVisible();
    });

    test('clicking auto refresh again toggles it back on', async ({ endpointDetailPage }) => {
      await endpointDetailPage.toggleAutoRefresh();
      const offClasses = await endpointDetailPage.autoRefreshToggle.getAttribute('class');
      expect(offClasses).toContain('action-bar__live--off');

      await endpointDetailPage.toggleAutoRefresh();
      const onClasses = await endpointDetailPage.autoRefreshToggle.getAttribute('class');
      expect(onClasses).toContain('action-bar__live--on');
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

    test('dialog has Cancel and Delete All buttons', async ({ endpointDetailPage }) => {
      await endpointDetailPage.clickDeleteAll();
      await expect(endpointDetailPage.clearDialogCancel).toBeVisible();
      await expect(endpointDetailPage.clearDialogConfirm).toBeVisible();
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

    test('URL toolbar has Edit and Copy buttons', async ({ page, endpointDetailPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Toolbar Buttons');
      await navigateToEndpoint(page, 'Toolbar Buttons');

      await expect(endpointDetailPage.editButton).toBeVisible();
      await expect(endpointDetailPage.copyButton).toBeVisible();
    });
  });
});
