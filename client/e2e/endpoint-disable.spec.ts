import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  createEndpointViaUI,
  disableEndpointViaUI,
} from './fixtures/emulator-helpers';

/**
 * Endpoint disable/enable tests — runs against real Firebase emulators.
 * Creates real endpoints and disables them via the dropdown menu.
 */
test.describe('Endpoint Disable/Enable', () => {
  test.describe('Disabled Endpoint Display', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Active Endpoint');
      await createEndpointViaUI(page, 'Disabled Endpoint');
      await createEndpointViaUI(page, 'Another Active');
      await disableEndpointViaUI(page, 'Disabled Endpoint');
    });

    test('disabled endpoint card shows Closed status', async ({ page }) => {
      const disabledCard = page.locator('.webhook-card', { hasText: 'Disabled Endpoint' });
      await expect(disabledCard).toBeVisible();
      await expect(disabledCard.getByText('Closed')).toBeVisible();
    });

    test('active endpoint card shows Active status', async ({ page }) => {
      const activeCard = page.locator('.webhook-card', { hasText: 'Active Endpoint' });
      await expect(activeCard).toBeVisible();
      await expect(activeCard.getByText('Active')).toBeVisible();
    });

    test('disabled endpoint card does not show green status dot', async ({ page }) => {
      const disabledCard = page.locator('.webhook-card', { hasText: 'Disabled Endpoint' });
      const statusDot = disabledCard.locator('.webhook-card__status-dot');
      const dotCount = await statusDot.count();
      expect(dotCount).toBe(0);
    });

    test('active endpoint card shows green status dot', async ({ page }) => {
      const activeCard = page.locator('.webhook-card', { hasText: 'Active Endpoint' });
      const statusDot = activeCard.locator('.webhook-card__status-dot');
      await expect(statusDot).toBeVisible();
    });
  });

  test.describe('Filter Pills with Mixed States', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Active Endpoint');
      await createEndpointViaUI(page, 'Disabled Endpoint');
      await createEndpointViaUI(page, 'Another Active');
      await disableEndpointViaUI(page, 'Disabled Endpoint');
    });

    test('All filter shows correct count with mixed endpoints', async ({ dashboardPage }) => {
      await expect(dashboardPage.allFilter).toContainText('03');
    });

    test('Active filter shows correct count', async ({ dashboardPage }) => {
      await expect(dashboardPage.activeFilter).toContainText('02');
    });

    test('Closed filter shows correct count', async ({ dashboardPage }) => {
      await expect(dashboardPage.closedFilter).toContainText('01');
    });

    test('Active filter shows only active endpoints', async ({ dashboardPage, page }) => {
      await dashboardPage.filterByActive();

      await expect(page.getByText('Active Endpoint')).toBeVisible();
      await expect(page.getByText('Another Active')).toBeVisible();
      await expect(page.getByText('Disabled Endpoint')).not.toBeVisible();
    });

    test('Closed filter shows only disabled endpoints', async ({ dashboardPage, page }) => {
      await dashboardPage.filterByClosed();

      await expect(page.getByText('Disabled Endpoint')).toBeVisible();
      await expect(page.getByText('Active Endpoint')).not.toBeVisible();
      await expect(page.getByText('Another Active')).not.toBeVisible();
    });

    test('All filter shows all endpoints regardless of status', async ({ dashboardPage, page }) => {
      await dashboardPage.filterByClosed();
      await dashboardPage.filterByAll();

      await expect(page.getByText('Active Endpoint')).toBeVisible();
      await expect(page.getByText('Disabled Endpoint')).toBeVisible();
      await expect(page.getByText('Another Active')).toBeVisible();
    });
  });

  test.describe('Dropdown Menu Options', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Active Endpoint');
      await createEndpointViaUI(page, 'Disabled Endpoint');
      await disableEndpointViaUI(page, 'Disabled Endpoint');
    });

    test('active endpoint dropdown shows Disable option', async ({ dashboardPage, page }) => {
      await dashboardPage.openEndpointOptions('Active Endpoint');
      await expect(page.getByRole('menuitem', { name: 'Disable' })).toBeVisible();
    });

    test('disabled endpoint dropdown shows Enable option', async ({ dashboardPage, page }) => {
      await dashboardPage.openEndpointOptions('Disabled Endpoint');
      await expect(page.getByRole('menuitem', { name: 'Enable' })).toBeVisible();
    });

    test('active endpoint dropdown has Edit Script, Disable, and Delete options', async ({
      dashboardPage,
      page,
    }) => {
      await dashboardPage.openEndpointOptions('Active Endpoint');
      await expect(page.getByRole('menuitem', { name: 'Edit Script' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Disable' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    });

    test('disabled endpoint dropdown has Edit Script, Enable, and Delete options', async ({
      dashboardPage,
      page,
    }) => {
      await dashboardPage.openEndpointOptions('Disabled Endpoint');
      await expect(page.getByRole('menuitem', { name: 'Edit Script' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Enable' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    });
  });

  test.describe('Search with Mixed States', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Active Endpoint');
      await createEndpointViaUI(page, 'Disabled Endpoint');
      await createEndpointViaUI(page, 'Another Active');
      await disableEndpointViaUI(page, 'Disabled Endpoint');
    });

    test('search finds disabled endpoints', async ({ dashboardPage, page }) => {
      await dashboardPage.searchEndpoints('Disabled');
      await expect(page.getByText('Disabled Endpoint')).toBeVisible();
      await expect(page.getByText('Active Endpoint')).not.toBeVisible();
    });

    test('search combined with Closed filter works', async ({ dashboardPage, page }) => {
      await dashboardPage.filterByClosed();
      await dashboardPage.searchEndpoints('Disabled');
      await expect(page.getByText('Disabled Endpoint')).toBeVisible();
    });

    test('search combined with Active filter excludes disabled endpoints', async ({
      dashboardPage,
      page,
    }) => {
      await dashboardPage.filterByActive();
      await dashboardPage.searchEndpoints('Endpoint');
      await expect(page.getByText('Active Endpoint')).toBeVisible();
      await expect(page.getByText('Disabled Endpoint')).not.toBeVisible();
    });
  });
});
