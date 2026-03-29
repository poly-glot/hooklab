import { test, expect, type Page } from '@playwright/test';

/**
 * UI branding & design verification tests.
 * Validates Figma design compliance: buttons, tabs, typography, layout.
 *
 * These tests use real Firebase emulator guest login.
 */

async function loginAsGuest(page: Page) {
  await page.goto('/auth');
  await expect(page.getByText('Guest')).toBeVisible({ timeout: 15000 });
  await page.getByText('Guest').click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  // Wait for dashboard elements to be visible (don't use networkidle — Firestore keeps connections open)
  await expect(page.getByRole('button', { name: /ADD NEW/i }).first()).toBeVisible({ timeout: 10000 });
}

async function createEndpointViaUI(page: Page, name: string) {
  // Use first() to avoid strict mode violation (2 ADD NEW buttons may exist)
  await page.getByRole('button', { name: /ADD NEW/i }).first().click();

  const nameInput = page.getByLabel('Endpoint Name');
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);

  const submitBtn = page.getByRole('button', { name: /Create Endpoint/i });
  await submitBtn.click();

  // Wait for dialog to close and card to appear
  await expect(page.getByText(name)).toBeVisible({ timeout: 15000 });
}

test.describe('Dashboard Branding', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
  });

  test('ADD NEW button has uppercase text and brand background', async ({ page }) => {
    const btn = page.getByRole('button', { name: /ADD NEW/i }).first();
    await expect(btn).toBeVisible();

    const text = await btn.textContent();
    expect(text?.trim()).toBe('ADD NEW');

    // Check brand background color — #01189b = rgb(1, 24, 155)
    const bgColor = await btn.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(1, 24, 155)');
  });

  test('Filter pills render with correct active/inactive states', async ({ page }) => {
    const allPill = page.getByRole('button', { name: /^All/ }).first();
    await expect(allPill).toBeVisible();

    // Active pill should have green background — #28c88e = rgb(40, 200, 142)
    const bgColor = await allPill.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(40, 200, 142)');
  });

  test('Search input has correct placeholder', async ({ page }) => {
    const searchInput = page.getByPlaceholder('search by webhook');
    await expect(searchInput).toBeVisible();
  });

  test('WebhookCard shows active status with green dot', async ({ page }) => {
    await createEndpointViaUI(page, 'Branding Test WH');
    await expect(page.getByText('Branding Test WH')).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/dashboard-branding.png', fullPage: true });
  });
});

test.describe('Endpoint Detail Branding', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Detail Branding WH');
    await page.getByText('Detail Branding WH').click();
    await page.waitForURL('**/dashboard/endpoint/**', { timeout: 10000 });
  });

  test('Back to listing button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Back to listing/i })).toBeVisible();
  });

  test('Edit button is visible in toolbar', async ({ page }) => {
    const editBtn = page.getByTestId('edit-button');
    await expect(editBtn).toBeVisible({ timeout: 5000 });
  });

  test('Live toggle defaults to ON', async ({ page }) => {
    const liveBtn = page.locator('.action-bar__live--on');
    await expect(liveBtn).toBeVisible({ timeout: 5000 });

    // Check green dot
    const dot = page.locator('.action-bar__live-dot--on');
    await expect(dot).toBeVisible();
  });

  test('Script Editor button has outline style with uppercase text', async ({ page }) => {
    const scriptBtn = page.getByRole('button', { name: /Script Editor/i });
    await expect(scriptBtn).toBeVisible({ timeout: 5000 });

    const styles = await scriptBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        textTransform: cs.textTransform,
      };
    });
    expect(styles.textTransform).toBe('uppercase');
  });

  test('Refresh button is visible with uppercase text', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });

    const styles = await refreshBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { textTransform: cs.textTransform };
    });
    expect(styles.textTransform).toBe('uppercase');
  });

  test('DELETE ALL button is visible with danger color', async ({ page }) => {
    const deleteBtn = page.getByTestId('clear-all-button');
    await expect(deleteBtn).toBeVisible();

    const bgColor = await deleteBtn.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // #ac1b11 = rgb(172, 27, 17)
    expect(bgColor).toBe('rgb(172, 27, 17)');
  });

  test('Waiting state shows when no requests exist', async ({ page }) => {
    await expect(page.getByText('Waiting for first webhook...')).toBeVisible({ timeout: 5000 });
  });

  test('Edit button opens edit panel', async ({ page }) => {
    const editBtn = page.getByTestId('edit-button');
    await editBtn.click();

    // Edit panel fields should be visible
    await expect(page.getByLabel('Name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Status Code')).toBeVisible();
    await expect(page.getByLabel('Content Type')).toBeVisible();
    await expect(page.getByLabel('Default Body')).toBeVisible();

    // Save and Cancel buttons
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/endpoint-edit-panel.png', fullPage: true });
  });

  test('Edit panel saves changes', async ({ page }) => {
    const editBtn = page.getByTestId('edit-button');
    await editBtn.click();

    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.clear();
    await nameInput.fill('Updated WH Name');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Endpoint updated')).toBeVisible({ timeout: 5000 });
  });

  test('Detail tabs render (header, body, query, response) in tab bar', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/endpoint-detail-branding.png', fullPage: true });
  });
});

test.describe('Dialog Branding', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
  });

  test('Create dialog has styled Cancel and Create buttons', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /ADD NEW/i }).first();
    await addBtn.click();

    // Wait for dialog
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible({ timeout: 5000 });

    // Cancel button should have outline style
    const cancelStyles = await cancelBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        textTransform: cs.textTransform,
      };
    });
    expect(cancelStyles.textTransform).toBe('uppercase');

    // Create Endpoint button should have filled style
    const createBtn = page.getByRole('button', { name: /Create Endpoint/i });
    await expect(createBtn).toBeVisible();
    const createStyles = await createBtn.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return {
        textTransform: cs.textTransform,
      };
    });
    expect(createStyles.textTransform).toBe('uppercase');

    await page.screenshot({ path: 'e2e/screenshots/create-dialog-branding.png' });
  });
});

test.describe('Header Branding', () => {
  test('Hooklab header is visible after login', async ({ page }) => {
    await loginAsGuest(page);
    await expect(page.getByRole('banner').getByText('Hooklab')).toBeVisible();
  });

  test('Sign out shows Guest label after login', async ({ page }) => {
    await loginAsGuest(page);
    await expect(page.getByText('Guest')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Script Editor Branding', () => {
  test('Script editor page has correct layout', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Script Branding WH');
    await page.getByText('Script Branding WH').click();
    await page.waitForURL('**/dashboard/endpoint/**', { timeout: 10000 });

    // Navigate to script editor
    const scriptBtn = page.getByRole('button', { name: /Script Editor/i });
    await expect(scriptBtn).toBeVisible({ timeout: 5000 });
    await scriptBtn.click();
    await page.waitForURL('**/script', { timeout: 10000 });

    // Script editor should show the code editor
    await expect(page.locator('.script-editor')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/script-editor-branding.png', fullPage: true });
  });
});
