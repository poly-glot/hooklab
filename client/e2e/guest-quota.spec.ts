import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  createEndpointViaUI,
} from './fixtures/emulator-helpers';

/**
 * Guest endpoint quota enforcement tests.
 * Guest users are limited to 10 endpoints (6 seeded + 4 manual).
 * Tests verify creation up to the limit, rejection at the limit,
 * and quota recovery after deletion.
 */
test.describe('Guest Endpoint Quota', () => {
  // Quota tests are slow (create many endpoints) — run serially
  test.describe.configure({ mode: 'serial' });

  test('guest can create endpoints up to the limit of 10', async ({
    page,
    dashboardPage,
  }) => {
    await loginAsGuest(page);

    // Wait for 6 seeded endpoints (seed is fire-and-forget, may take time)
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 20000 });

    // Create 4 more to reach the limit of 10
    await createEndpointViaUI(page, 'Quota Test 1');
    await createEndpointViaUI(page, 'Quota Test 2');
    await createEndpointViaUI(page, 'Quota Test 3');
    await createEndpointViaUI(page, 'Quota Test 4');

    await expect(dashboardPage.endpointCards).toHaveCount(10, { timeout: 10000 });
  });

  test('guest is blocked at endpoint limit with error', async ({
    page,
    dashboardPage,
  }) => {
    await loginAsGuest(page);
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 20000 });

    // Create 4 more to reach the limit of 10
    for (let i = 1; i <= 4; i++) {
      await createEndpointViaUI(page, `Limit Fill ${i}`);
    }
    await expect(dashboardPage.endpointCards).toHaveCount(10, { timeout: 10000 });

    // Try to create one more — should fail (Firestore rules block it)
    await dashboardPage.clickAddNew();
    await expect(dashboardPage.createDialogTitle).toBeVisible();
    await dashboardPage.fillEndpointName('Over The Limit');
    await dashboardPage.submitCreateEndpoint();

    // Expect error toast about limit/quota/permission
    await expect(
      page.getByText(/limit|quota|maximum|permission|denied/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Endpoint count should remain 10
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await page.keyboard.press('Escape');
    }
    await expect(dashboardPage.endpointCards).toHaveCount(10, { timeout: 5000 });
  });

  test('deleting an endpoint frees quota for new creation', async ({
    page,
    dashboardPage,
  }) => {
    await loginAsGuest(page);
    await expect(dashboardPage.endpointCards).toHaveCount(6, { timeout: 20000 });

    // Fill to limit
    for (let i = 1; i <= 4; i++) {
      await createEndpointViaUI(page, `Quota Free ${i}`);
    }
    await expect(dashboardPage.endpointCards).toHaveCount(10, { timeout: 10000 });

    // Delete one endpoint
    await dashboardPage.openEndpointOptions('Quota Free 4');
    await dashboardPage.clickDeleteInDropdown();
    await dashboardPage.confirmDelete();
    await expect(page.getByText('Quota Free 4')).not.toBeVisible({ timeout: 10000 });

    // Wait for endpointCount to decrement (fire-and-forget)
    await page.waitForTimeout(2000);

    // Now creation should succeed again
    await createEndpointViaUI(page, 'Freed Slot');
    await expect(page.getByText('Freed Slot')).toBeVisible({ timeout: 10000 });
  });
});
