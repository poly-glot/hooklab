import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  createEndpointViaUI,
} from './fixtures/emulator-helpers';

/**
 * Dashboard page tests — runs against real Firebase emulators.
 * Each test group logs in as guest and creates real endpoints via UI.
 */
test.describe('Dashboard Page - Authenticated Journey', () => {
  test.describe('Dashboard Layout', () => {
    test('dashboard loads with all key UI elements', async ({ page, dashboardPage }) => {
      await loginAsGuest(page);

      await dashboardPage.expectLoaded();
      await expect(dashboardPage.headerLogo).toHaveText('Hooklab');
      await expect(dashboardPage.githubLink).toBeVisible();
      await expect(dashboardPage.searchInput).toBeVisible();
      await expect(dashboardPage.addNewButton).toBeVisible();
      await expect(dashboardPage.allFilter).toBeVisible();
      await expect(dashboardPage.activeFilter).toBeVisible();
      await expect(dashboardPage.closedFilter).toBeVisible();
    });
  });

  test.describe('Endpoint List Display', () => {
    test('shows endpoint cards when endpoints exist', async ({ page, dashboardPage }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Payment Webhooks');
      await createEndpointViaUI(page, 'Order Notifications');
      await createEndpointViaUI(page, 'Stripe Events');

      await dashboardPage.expectEndpointsVisible([
        'Payment Webhooks',
        'Order Notifications',
        'Stripe Events',
      ]);
    });

    test('endpoint cards show URL, Active status, and options button', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Card Details Test');

      const card = page.locator('.webhook-card', { hasText: 'Card Details Test' });
      await expect(card.getByText(/\/w\//)).toBeVisible();
      await expect(card.getByText('Active', { exact: true })).toBeVisible();
      await expect(card.getByLabel('Options')).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Payment Webhooks');
      await createEndpointViaUI(page, 'Order Notifications');
      await createEndpointViaUI(page, 'Stripe Events');
    });

    test('search filters endpoints by name', async ({ dashboardPage, page }) => {
      await dashboardPage.searchEndpoints('Payment');
      await expect(page.getByText('Payment Webhooks')).toBeVisible();
      await expect(page.getByText('Order Notifications')).not.toBeVisible();
      await expect(page.getByText('Stripe Events')).not.toBeVisible();
    });

    test('search is case-insensitive', async ({ dashboardPage, page }) => {
      await dashboardPage.searchEndpoints('payment');
      await expect(page.getByText('Payment Webhooks')).toBeVisible();
    });

    test('no results shows empty filter message', async ({ dashboardPage, page }) => {
      await dashboardPage.searchEndpoints('nonexistent-webhook');
      await expect(page.getByText('No endpoints match your filter.')).toBeVisible();
    });

    test('clearing search shows all endpoints again', async ({ dashboardPage, page }) => {
      await dashboardPage.searchEndpoints('Payment');
      await expect(page.getByText('Order Notifications')).not.toBeVisible();

      await dashboardPage.clearSearch();
      await expect(page.getByText('Payment Webhooks')).toBeVisible();
      await expect(page.getByText('Order Notifications')).toBeVisible();
    });
  });

  test.describe('Filter Pills', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Payment Webhooks');
      await createEndpointViaUI(page, 'Order Notifications');
      await createEndpointViaUI(page, 'Stripe Events');
    });

    test('clicking Active filter shows only active endpoints', async ({ dashboardPage, page }) => {
      await dashboardPage.filterByActive();
      await expect(page.getByText('Payment Webhooks')).toBeVisible();
    });

    test('clicking Closed filter shows no endpoints message', async ({ dashboardPage, page }) => {
      await dashboardPage.filterByClosed();
      await expect(page.getByText('No endpoints match your filter.')).toBeVisible();
    });

    test('clicking All filter after Closed restores all endpoints', async ({
      dashboardPage,
      page,
    }) => {
      await dashboardPage.filterByClosed();
      await expect(page.getByText('No endpoints match your filter.')).toBeVisible();

      await dashboardPage.filterByAll();
      await expect(page.getByText('Payment Webhooks')).toBeVisible();
    });
  });

  test.describe('Create Endpoint Dialog', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
    });

    test('ADD NEW button opens create dialog', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await expect(dashboardPage.createDialogTitle).toBeVisible();
    });

    test('Cancel button closes the create dialog', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await expect(dashboardPage.createDialogTitle).toBeVisible();

      await dashboardPage.cancelCreateEndpoint();
      await expect(dashboardPage.createDialogTitle).not.toBeVisible();
    });

    test('empty name shows error toast on submit', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await dashboardPage.submitCreateEndpoint();
      await dashboardPage.expectErrorToast('Please enter an endpoint name');
    });

    test('endpoint name input supports Enter key to submit', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await dashboardPage.fillEndpointName('');
      await dashboardPage.endpointNameInput.press('Enter');
      await dashboardPage.expectErrorToast('Please enter an endpoint name');
    });

    test('input has autofocus when dialog opens', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await expect(dashboardPage.endpointNameInput).toBeFocused();
    });

    test('creating an endpoint adds it to the list', async ({ page, dashboardPage }) => {
      await createEndpointViaUI(page, 'Brand New Webhook');
      await expect(page.getByText('Brand New Webhook')).toBeVisible();
    });
  });

  test.describe('Delete Endpoint Flow', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Payment Webhooks');
    });

    test('options button opens dropdown with Delete option', async ({
      dashboardPage,
      page,
    }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    });

    test('clicking Delete opens confirmation dialog', async ({ dashboardPage }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await dashboardPage.clickDeleteInDropdown();
      await expect(dashboardPage.deleteDialogTitle).toBeVisible();
    });

    test('delete confirmation dialog shows warning text', async ({ dashboardPage, page }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await dashboardPage.clickDeleteInDropdown();
      await expect(
        page.getByText('This will permanently delete this endpoint')
      ).toBeVisible();
      await expect(page.getByText('This action cannot be undone')).toBeVisible();
    });

    test('Cancel button on delete dialog closes it', async ({ dashboardPage }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await dashboardPage.clickDeleteInDropdown();
      await expect(dashboardPage.deleteDialogTitle).toBeVisible();

      await dashboardPage.cancelDelete();
      await expect(dashboardPage.deleteDialogTitle).not.toBeVisible();
    });

    test('confirming delete removes the endpoint from the list', async ({
      dashboardPage,
      page,
    }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await dashboardPage.clickDeleteInDropdown();
      await dashboardPage.confirmDelete();

      // Endpoint should disappear from the list
      await expect(page.getByText('Payment Webhooks')).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Endpoint Navigation', () => {
    test('clicking endpoint card navigates to endpoint detail', async ({
      page,
      dashboardPage,
    }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Nav Test Endpoint');
      await dashboardPage.clickEndpointCard('Nav Test Endpoint');
      await expect(page).toHaveURL(/\/dashboard\/endpoint\//);
    });
  });

});
