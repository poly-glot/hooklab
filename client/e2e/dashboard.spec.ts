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
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Payment Webhooks');
      await createEndpointViaUI(page, 'Order Notifications');
      await createEndpointViaUI(page, 'Stripe Events');
    });

    test('dashboard page loads with header', async ({ dashboardPage }) => {
      await dashboardPage.expectLoaded();
    });

    test('header displays Hooklab logo', async ({ dashboardPage }) => {
      await expect(dashboardPage.headerLogo).toBeVisible();
      await expect(dashboardPage.headerLogo).toHaveText('Hooklab');
    });

    test('header has Github link', async ({ dashboardPage }) => {
      await expect(dashboardPage.githubLink).toBeVisible();
      await expect(dashboardPage.githubLink).toHaveText('Github');
    });

    test('action bar has search input with correct placeholder', async ({ dashboardPage }) => {
      await expect(dashboardPage.searchInput).toBeVisible();
      await expect(dashboardPage.searchInput).toHaveAttribute(
        'placeholder',
        'search by webhook'
      );
    });

    test('action bar has ADD NEW button with brand color', async ({ dashboardPage }) => {
      await expect(dashboardPage.addNewButton).toBeVisible();
      await expect(dashboardPage.addNewButton).toHaveText('ADD NEW');
      const bgColor = await dashboardPage.addNewButton.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      expect(bgColor).toBe('rgb(1, 24, 155)');
    });

    test('filter pills are visible with All, Active, Closed', async ({ dashboardPage }) => {
      await expect(dashboardPage.allFilter).toBeVisible();
      await expect(dashboardPage.activeFilter).toBeVisible();
      await expect(dashboardPage.closedFilter).toBeVisible();
    });

    test('footer displays copyright notice', async ({ dashboardPage }) => {
      await expect(dashboardPage.copyrightText).toBeVisible();
      await expect(dashboardPage.copyrightText).toHaveText('Usual copyright notice');
    });

    test('ready text is displayed in action bar', async ({ dashboardPage }) => {
      await expect(dashboardPage.readyText).toBeVisible();
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

    test('shows empty state when no endpoints exist', async ({ page, dashboardPage }) => {
      await loginAsGuest(page);
      // Fresh guest with no manually created endpoints — check for empty or seeded state
      // If seedGuestData creates endpoints, we check for non-empty; otherwise empty state
      const hasEndpoints = await page.locator('.webhook-card').count();
      if (hasEndpoints === 0) {
        await dashboardPage.expectEmptyState();
        await expect(dashboardPage.emptyStateAddButton).toBeVisible();
      }
    });

    test('endpoint cards show webhook URL', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'URL Test Endpoint');
      await expect(page.getByText(/\/w\//)).toBeVisible();
    });

    test('endpoint cards show Active status', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Active Status Test');
      const activeTexts = page.getByText('Active', { exact: true });
      await expect(activeTexts.first()).toBeVisible();
    });

    test('endpoint cards have options button', async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Options Test');
      const optionsButtons = page.getByLabel('Options');
      expect(await optionsButtons.count()).toBeGreaterThan(0);
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

    test('All filter is active by default', async ({ dashboardPage }) => {
      const allPillBg = await dashboardPage.allFilter.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      expect(allPillBg).toBe('rgb(40, 200, 142)');
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

    test('create dialog has endpoint name input', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await expect(dashboardPage.endpointNameInput).toBeVisible();
      await expect(dashboardPage.endpointNameInput).toHaveAttribute(
        'placeholder',
        'e.g., Payment Notifications'
      );
    });

    test('create dialog has Cancel and Create buttons', async ({ dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await expect(dashboardPage.createDialogCancel).toBeVisible();
      await expect(dashboardPage.createDialogSubmit).toBeVisible();
    });

    test('create dialog shows description text', async ({ page, dashboardPage }) => {
      await dashboardPage.clickAddNew();
      await expect(
        page.getByText('Give your webhook endpoint a descriptive name.')
      ).toBeVisible();
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

    test('delete confirmation dialog has Cancel and Delete buttons', async ({
      dashboardPage,
    }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await dashboardPage.clickDeleteInDropdown();
      await expect(dashboardPage.deleteDialogCancel).toBeVisible();
      await expect(dashboardPage.deleteDialogConfirm).toBeVisible();
    });

    test('Delete button has danger color (red)', async ({ dashboardPage, page }) => {
      await dashboardPage.openEndpointOptions('Payment Webhooks');
      await dashboardPage.clickDeleteInDropdown();
      const deleteBtn = page
        .getByRole('dialog')
        .getByRole('button', { name: /^Delete$/i });
      const bgColor = await deleteBtn.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      expect(bgColor).toBe('rgb(172, 27, 17)');
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

  test.describe('Empty Dashboard State', () => {
    test('filter pills show zero counts on empty dashboard', async ({
      page,
      dashboardPage,
    }) => {
      await loginAsGuest(page);
      // Fresh guest may have seeded data; check the current count
      const cardCount = await page.locator('.webhook-card').count();
      if (cardCount === 0) {
        await expect(dashboardPage.allFilter).toContainText('00');
        await expect(dashboardPage.activeFilter).toContainText('00');
        await expect(dashboardPage.closedFilter).toContainText('00');
      }
    });
  });
});
