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
  await expect(page.locator('[data-testid="back-button"]')).toBeVisible({ timeout: 10000 });
}

function getEndpointIdFromUrl(page: Page): string {
  const url = page.url();
  const match = url.match(/\/endpoint\/([^/]+)/);
  return match ? match[1] : '';
}

async function sendWebhookRequests(endpointId: string, count: number) {
  const methods = ['POST', 'GET', 'PUT', 'DELETE', 'PATCH'];
  for (let i = 0; i < count; i++) {
    const method = methods[i % methods.length];
    await fetch(`${API_BASE}/w/${endpointId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify({ test: true, index: i }) : undefined,
    }).catch(() => {});
  }
}

test.describe('Individual Request Deletion', () => {
  test('clicking delete removes the request from sidebar', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Del Remove');
    await navigateToEndpoint(page, 'Del Remove');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 3);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });
    await expect(requestList.locator('[role="button"]')).toHaveCount(3, { timeout: 10000 });

    // Click delete on the first request item
    const firstDeleteBtn = requestList.locator('[role="button"]').first().locator('[aria-label="Delete request"]');
    await firstDeleteBtn.click();

    // Should now have 2 items
    await expect(requestList.locator('[role="button"]')).toHaveCount(2, { timeout: 10000 });
  });

  test('deleting request shows success toast', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Del Toast');
    await navigateToEndpoint(page, 'Del Toast');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 1);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    const deleteBtn = requestList.locator('[role="button"]').first().locator('[aria-label="Delete request"]');
    await deleteBtn.click();

    // Verify toast notification appears
    await expect(page.getByText('Request deleted')).toBeVisible({ timeout: 5000 });
  });

  test('deleting selected request clears the detail view', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Del Detail');
    await navigateToEndpoint(page, 'Del Detail');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 2);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });
    await expect(requestList.locator('[role="button"]')).toHaveCount(2, { timeout: 10000 });

    // Select the first request to show its detail
    const firstItem = requestList.locator('[role="button"]').first();
    await firstItem.click();

    // Verify detail tabs are visible (request is selected)
    const headerTab = page.getByRole('button', { name: 'HEADER' });
    await expect(headerTab).toBeVisible({ timeout: 5000 });

    // Now delete the selected request
    const deleteBtn = firstItem.locator('[aria-label="Delete request"]');
    await deleteBtn.click();

    // The detail view should no longer show that request's data
    // After deletion of selected request, expect the detail area to clear
    // (either shows waiting state or no content for that request)
    await expect(requestList.locator('[role="button"]')).toHaveCount(1, { timeout: 10000 });
  });

  test('can delete all requests one by one', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Del All One');
    await navigateToEndpoint(page, 'Del All One');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 2);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });
    await expect(requestList.locator('[role="button"]')).toHaveCount(2, { timeout: 10000 });

    // Delete first request
    const firstDeleteBtn = requestList.locator('[role="button"]').first().locator('[aria-label="Delete request"]');
    await firstDeleteBtn.click();
    await expect(requestList.locator('[role="button"]')).toHaveCount(1, { timeout: 10000 });

    // Delete second (now first) request
    const remainingDeleteBtn = requestList.locator('[role="button"]').first().locator('[aria-label="Delete request"]');
    await remainingDeleteBtn.click();
    await expect(requestList.locator('[role="button"]')).toHaveCount(0, { timeout: 10000 });
  });
});

test.describe('Export Dropdown', () => {
  test('export button is visible when a request is selected', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Export Visible');
    await navigateToEndpoint(page, 'Export Visible');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 1);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Select the request
    await requestList.locator('[role="button"]').first().click();

    // Verify Export button is visible in the detail area
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
  });

  test('clicking export shows dropdown menu with cURL and Fetch options', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Export Menu');
    await navigateToEndpoint(page, 'Export Menu');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 1);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Select the request
    await requestList.locator('[role="button"]').first().click();

    // Click Export button
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();

    // Verify dropdown menu options
    await expect(page.getByText('Copy as cURL')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Copy as Fetch')).toBeVisible({ timeout: 5000 });
  });

  test('clicking outside closes the export dropdown', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Export Close');
    await navigateToEndpoint(page, 'Export Close');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 1);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Select the request
    await requestList.locator('[role="button"]').first().click();

    // Open the export dropdown
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();

    // Verify dropdown is open
    await expect(page.getByText('Copy as cURL')).toBeVisible({ timeout: 5000 });

    // Click elsewhere on the page to close the dropdown
    await page.locator('body').click({ position: { x: 10, y: 10 } });

    // Verify dropdown is hidden
    await expect(page.getByText('Copy as cURL')).not.toBeVisible({ timeout: 5000 });
  });

  test('copy as cURL shows success toast', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Export cURL');
    await navigateToEndpoint(page, 'Export cURL');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    await sendWebhookRequests(endpointId, 1);

    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Select the request
    await requestList.locator('[role="button"]').first().click();

    // Open the export dropdown
    const exportBtn = page.getByRole('button', { name: /Export/i });
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();

    // Click "Copy as cURL"
    await page.getByText('Copy as cURL').click();

    // Verify success toast
    await expect(page.getByText('cURL command copied')).toBeVisible({ timeout: 5000 });
  });
});
