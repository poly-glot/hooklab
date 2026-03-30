import { test, expect, type Page } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function loginAsGuest(page: Page) {
  await page.goto('/auth');
  await expect(page.getByText('Guest')).toBeVisible({ timeout: 10000 });
  await page.getByText('Guest').click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

async function createEndpointViaUI(page: Page, name: string) {
  const createBtn = page.getByRole('button', { name: 'ADD NEW' }).first();
  await expect(createBtn).toBeVisible({ timeout: 5000 });
  await createBtn.click();
  const nameInput = page.getByRole('textbox', { name: 'Endpoint Name' });
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(name);
  const submitBtn = page.getByRole('button', { name: 'Create Endpoint' });
  await submitBtn.click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}

async function navigateToEndpoint(page: Page, name: string) {
  await page.getByText(name).click();
  await page.waitForURL('**/dashboard/endpoint/**', { timeout: 10000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 10000 });
}

test.describe('Endpoint Edit Panel', () => {
  test('clicking edit opens the edit panel', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Edit Open Test');
    await navigateToEndpoint(page, 'Edit Open Test');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    await expect(page.getByText('Name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Status Code')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Content Type')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Default Body')).toBeVisible({ timeout: 5000 });
  });

  test('edit panel pre-fills current endpoint values', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Prefill Test EP');
    await navigateToEndpoint(page, 'Prefill Test EP');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await editBtn.click();

    const nameInput = page.locator('input#edit-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('Prefill Test EP');

    const statusCodeInput = page.locator('input#edit-status-code');
    await expect(statusCodeInput).toHaveValue('200');

    const contentTypeInput = page.locator('input#edit-content-type');
    await expect(contentTypeInput).toHaveValue('application/json');

    const defaultBodyInput = page.locator('textarea#edit-default-body');
    await expect(defaultBodyInput).toHaveValue('{"ok": true}');
  });

  test('cancel closes the edit panel without saving', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Cancel Test EP');
    await navigateToEndpoint(page, 'Cancel Test EP');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await editBtn.click();

    const nameInput = page.locator('input#edit-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.clear();
    await nameInput.fill('Changed Name');

    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();

    // Edit panel should be gone (name input no longer visible)
    await expect(nameInput).not.toBeVisible({ timeout: 5000 });

    // Re-open edit to verify original name was preserved
    await editBtn.click();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).toHaveValue('Cancel Test EP');
  });

  test('save updates endpoint name', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Rename Me EP');
    await navigateToEndpoint(page, 'Rename Me EP');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await editBtn.click();

    const nameInput = page.locator('input#edit-name');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.clear();
    await nameInput.fill('Renamed Endpoint');

    const saveBtn = page.getByRole('button', { name: 'Save' });
    await saveBtn.click();

    // Should show success toast
    await expect(page.getByText('Endpoint updated')).toBeVisible({ timeout: 5000 });

    // Panel should close
    await expect(nameInput).not.toBeVisible({ timeout: 5000 });

    // Re-open edit to verify name was saved
    await editBtn.click();
    await expect(page.locator('input#edit-name')).toHaveValue('Renamed Endpoint');
  });

  test('save updates default status code', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Status Code EP');
    await navigateToEndpoint(page, 'Status Code EP');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await editBtn.click();

    const statusCodeInput = page.locator('input#edit-status-code');
    await expect(statusCodeInput).toBeVisible({ timeout: 5000 });
    await statusCodeInput.clear();
    await statusCodeInput.fill('201');

    const saveBtn = page.getByRole('button', { name: 'Save' });
    await saveBtn.click();

    await expect(page.getByText('Endpoint updated')).toBeVisible({ timeout: 5000 });

    // Re-open edit to verify saved value
    await editBtn.click();
    await expect(page.locator('input#edit-status-code')).toHaveValue('201');
  });

  test('save updates default body', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Body Update EP');
    await navigateToEndpoint(page, 'Body Update EP');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await editBtn.click();

    const defaultBodyInput = page.locator('textarea#edit-default-body');
    await expect(defaultBodyInput).toBeVisible({ timeout: 5000 });
    await defaultBodyInput.clear();
    await defaultBodyInput.fill('{"custom": true}');

    const saveBtn = page.getByRole('button', { name: 'Save' });
    await saveBtn.click();

    await expect(page.getByText('Endpoint updated')).toBeVisible({ timeout: 5000 });

    // Re-open edit to verify saved value
    await editBtn.click();
    await expect(page.locator('textarea#edit-default-body')).toHaveValue('{"custom": true}');
  });

  test('save updates content type', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'ContentType EP');
    await navigateToEndpoint(page, 'ContentType EP');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await editBtn.click();

    const contentTypeInput = page.locator('input#edit-content-type');
    await expect(contentTypeInput).toBeVisible({ timeout: 5000 });
    await contentTypeInput.clear();
    await contentTypeInput.fill('text/plain');

    const saveBtn = page.getByRole('button', { name: 'Save' });
    await saveBtn.click();

    await expect(page.getByText('Endpoint updated')).toBeVisible({ timeout: 5000 });

    // Re-open edit to verify saved value
    await editBtn.click();
    await expect(page.locator('input#edit-content-type')).toHaveValue('text/plain');
  });

});
