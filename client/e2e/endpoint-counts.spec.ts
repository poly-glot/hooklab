import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  createEndpointViaUI,
  disableEndpointViaUI,
} from './fixtures/emulator-helpers';

/**
 * Filter pill count tests — verifies that All/Active/Closed counts
 * update correctly after creating, disabling, and deleting endpoints.
 */
test.describe('Endpoint Filter Counts', () => {

  /** Parse the count number from a filter pill like "All 06" or "Active 04". */
  async function getFilterCount(pillLocator: import('@playwright/test').Locator): Promise<number> {
    const text = await pillLocator.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  test('seeded guest has correct initial counts', async ({ page, dashboardPage }) => {
    await loginAsGuest(page);
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 15000 });

    // All should be 6, Active should be 6, Closed should be 0
    await expect(dashboardPage.allFilter).toContainText('06');
    await expect(dashboardPage.activeFilter).toContainText('06');
    await expect(dashboardPage.closedFilter).toContainText('00');
  });

  test('counts update after creating endpoints', async ({ page, dashboardPage }) => {
    await loginAsGuest(page);
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 15000 });

    const initialAll = await getFilterCount(dashboardPage.allFilter);

    await createEndpointViaUI(page, 'Count Test A');
    await createEndpointViaUI(page, 'Count Test B');

    // All and Active should increase by 2
    await expect(dashboardPage.allFilter).toContainText(
      String(initialAll + 2).padStart(2, '0')
    );
    await expect(dashboardPage.activeFilter).toContainText(
      String(initialAll + 2).padStart(2, '0')
    );
    // Closed should stay 0
    await expect(dashboardPage.closedFilter).toContainText('00');
  });

  test('disabling endpoint updates Active/Closed counts', async ({
    page,
    dashboardPage,
  }) => {
    await loginAsGuest(page);
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 15000 });

    await createEndpointViaUI(page, 'Disable Count Test');

    const allBefore = await getFilterCount(dashboardPage.allFilter);
    const activeBefore = await getFilterCount(dashboardPage.activeFilter);
    const closedBefore = await getFilterCount(dashboardPage.closedFilter);

    await disableEndpointViaUI(page, 'Disable Count Test');

    // All unchanged, Active -1, Closed +1
    await expect(dashboardPage.allFilter).toContainText(
      String(allBefore).padStart(2, '0')
    );
    await expect(dashboardPage.activeFilter).toContainText(
      String(activeBefore - 1).padStart(2, '0')
    );
    await expect(dashboardPage.closedFilter).toContainText(
      String(closedBefore + 1).padStart(2, '0')
    );
  });

  test('deleting endpoint decreases All count', async ({ page, dashboardPage }) => {
    await loginAsGuest(page);
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 15000 });

    await createEndpointViaUI(page, 'Delete Count Test');

    const allBefore = await getFilterCount(dashboardPage.allFilter);

    await dashboardPage.openEndpointOptions('Delete Count Test');
    await dashboardPage.clickDeleteInDropdown();
    await dashboardPage.confirmDelete();

    // Wait for the card to disappear
    await expect(page.getByText('Delete Count Test')).not.toBeVisible({ timeout: 10000 });

    // All should decrease by 1
    await expect(dashboardPage.allFilter).toContainText(
      String(allBefore - 1).padStart(2, '0'),
      { timeout: 5000 }
    );
  });
});
