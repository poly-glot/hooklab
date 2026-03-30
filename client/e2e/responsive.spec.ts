import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
} from './fixtures/emulator-helpers';

test.describe('Mobile Viewport (375x667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('guest login works on mobile', async ({ page }) => {
    await loginAsGuest(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard displays endpoints on mobile', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Mobile Dashboard EP');
    await expect(page.getByText('Mobile Dashboard EP')).toBeVisible();
  });

  test('can create endpoint on mobile', async ({ page }) => {
    await loginAsGuest(page);

    const createBtn = page.getByRole('button', { name: 'ADD NEW' }).first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    const nameInput = page.getByRole('textbox', { name: 'Endpoint Name' });
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Mobile Created EP');

    const submitBtn = page.getByRole('button', { name: 'Create Endpoint' });
    await submitBtn.click();

    await expect(page.getByText('Mobile Created EP')).toBeVisible({ timeout: 10000 });
  });

  test('endpoint detail loads on mobile', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Mobile Detail EP');
    await navigateToEndpoint(page, 'Mobile Detail EP');

    await expect(page.getByText('Mobile Detail EP')).toBeVisible({ timeout: 10000 });
  });

  test('mobile toolbar is visible instead of desktop toolbar', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Mobile Toolbar EP');
    await navigateToEndpoint(page, 'Mobile Toolbar EP');

    // On mobile, the mobile toolbar should be visible
    const mobileToolbar = page.locator('.action-bar__toolbar-mobile');
    await expect(mobileToolbar).toBeVisible({ timeout: 5000 });

    // On mobile, the desktop toolbar should NOT be visible
    const desktopToolbar = page.locator('.action-bar__toolbar');
    await expect(desktopToolbar).not.toBeVisible();
  });
});

test.describe('Tablet Viewport (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('create dialog works on tablet', async ({ page }) => {
    await loginAsGuest(page);

    const createBtn = page.getByRole('button', { name: 'ADD NEW' }).first();
    await expect(createBtn).toBeVisible({ timeout: 5000 });
    await createBtn.click();

    // Verify the dialog input fields are visible on tablet
    const nameInput = page.getByRole('textbox', { name: 'Endpoint Name' });
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    const submitBtn = page.getByRole('button', { name: 'Create Endpoint' });
    await expect(submitBtn).toBeVisible();

    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible();

    // Create the endpoint to verify the full flow works
    await nameInput.fill('Tablet Created EP');
    await submitBtn.click();
    await expect(page.getByText('Tablet Created EP')).toBeVisible({ timeout: 10000 });
  });
});
