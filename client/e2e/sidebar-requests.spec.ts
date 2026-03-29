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
      body: method !== 'GET' ? JSON.stringify({ test: true, index: i, data: `request-${i}` }) : undefined,
    }).catch(() => {});
  }
}

test.describe('Sidebar Requests & Branding', () => {
  test('requests appear in sidebar after sending webhooks', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Sidebar Test WH');
    await navigateToEndpoint(page, 'Sidebar Test WH');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    // Send 3 webhook requests
    await sendWebhookRequests(endpointId, 3);

    // Wait for real-time listener to update sidebar
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Should have 3 request items
    const items = requestList.locator('[role="button"]');
    await expect(items).toHaveCount(3, { timeout: 10000 });

    await page.screenshot({ path: 'e2e/screenshots/sidebar-with-requests.png', fullPage: true });
  });

  test('clicking a request shows details in content area', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Detail View WH');
    await navigateToEndpoint(page, 'Detail View WH');

    const endpointId = getEndpointIdFromUrl(page);
    await sendWebhookRequests(endpointId, 2);

    // Wait for requests to appear
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Click the first request
    await requestList.locator('[role="button"]').first().click();

    // Should see detail tabs
    const headerTab = page.getByRole('button', { name: 'HEADER' });
    const bodyTab = page.getByRole('button', { name: 'BODY' });
    const queryTab = page.getByRole('button', { name: 'QUERY' });
    const responseTab = page.getByRole('button', { name: 'RESPONSE' });

    await expect(headerTab).toBeVisible({ timeout: 5000 });
    await expect(bodyTab).toBeVisible({ timeout: 5000 });
    await expect(queryTab).toBeVisible({ timeout: 5000 });
    await expect(responseTab).toBeVisible({ timeout: 5000 });

    // Header tab should show KV rows like Host, Method
    await expect(page.locator('text=Host').first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/request-detail-header.png', fullPage: true });

    // Switch to Body tab
    await bodyTab.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e/screenshots/request-detail-body.png', fullPage: true });

    // Switch to Response tab
    await responseTab.click();
    await expect(page.locator('text=Status').first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/request-detail-response.png', fullPage: true });
  });

  test('back button is a subtle text link (no heavy border)', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Back Btn WH');
    await navigateToEndpoint(page, 'Back Btn WH');

    const backBtn = page.locator('[data-testid="back-button"]');
    await expect(backBtn).toBeVisible({ timeout: 5000 });

    // Should contain "Back" text
    const text = await backBtn.textContent();
    expect(text?.trim()).toMatch(/Back/);

    // Should NOT have heavy border (0px = no border)
    const borderWidth = await backBtn.evaluate((el) => getComputedStyle(el).borderWidth);
    expect(borderWidth).toBe('0px');

    // Text color should be muted grey, not black
    const color = await backBtn.evaluate((el) => getComputedStyle(el).color);
    // rgb(104, 104, 104) = #686868
    expect(color).toContain('104');
  });

  test('edit button is visible in action bar', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Edit Btn WH');
    await navigateToEndpoint(page, 'Edit Btn WH');

    const editBtn = page.locator('[data-testid="edit-button"]');
    await expect(editBtn).toBeVisible({ timeout: 5000 });

    // Check branding — border-2, uppercase
    const borderWidth = await editBtn.evaluate((el) => getComputedStyle(el).borderWidth);
    expect(borderWidth).toBe('2px');

    const textTransform = await editBtn.evaluate((el) => getComputedStyle(el).textTransform);
    expect(textTransform).toBe('uppercase');

    // Edit button should be positioned in the center area (to the right of the URL pill),
    // NOT on the far left next to Back. Verify its x position is past the sidebar width (300px).
    const backBtn = page.locator('[data-testid="back-button"]');
    const backBox = await backBtn.boundingBox();
    const editBox = await editBtn.boundingBox();
    expect(backBox).toBeTruthy();
    expect(editBox).toBeTruthy();
    // Edit should be significantly to the right of Back (center area)
    expect(editBox!.x).toBeGreaterThan(backBox!.x + 200);

    // Click edit to open panel
    await editBtn.click();
    await expect(page.getByText('Status Code')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Content Type')).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/edit-panel-open.png', fullPage: true });
  });

  test('clear all button has correct branding', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'ClearAll WH');
    await navigateToEndpoint(page, 'ClearAll WH');

    const clearBtn = page.locator('[data-testid="clear-all-button"]');
    await expect(clearBtn).toBeVisible({ timeout: 5000 });

    // Check border-width is 2px
    const borderWidth = await clearBtn.evaluate((el) => getComputedStyle(el).borderWidth);
    expect(borderWidth).toBe('2px');

    // Check border-color is #111 (not red)
    const borderColor = await clearBtn.evaluate((el) => getComputedStyle(el).borderColor);
    expect(borderColor).toContain('17'); // rgb(17, 17, 17)

    // Check uppercase
    const textTransform = await clearBtn.evaluate((el) => getComputedStyle(el).textTransform);
    expect(textTransform).toBe('uppercase');

    // Check NO border-radius
    const borderRadius = await clearBtn.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(borderRadius).toBe('0px');
  });
});

test.describe('Sidebar Pagination', () => {
  test('pagination appears with many requests and works correctly', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Pagination WH');
    await navigateToEndpoint(page, 'Pagination WH');

    const endpointId = getEndpointIdFromUrl(page);
    expect(endpointId).toBeTruthy();

    // Send 25 requests to trigger pagination (20 per page)
    await sendWebhookRequests(endpointId, 25);

    // Wait for requests to load via real-time listener
    const requestList = page.locator('[data-testid="request-list"]');
    // Wait until we see at least some items
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 15000 });

    // Wait a bit for all 25 to arrive
    await page.waitForTimeout(3000);

    // Pagination should be visible
    const pagination = page.locator('[data-testid="pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Should show "Page 1 of 2"
    await expect(pagination.getByText(/Page 1 of 2/)).toBeVisible({ timeout: 5000 });

    // Page 1 should have 20 items
    const itemsPage1 = requestList.locator('[role="button"]');
    await expect(itemsPage1).toHaveCount(20, { timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/pagination-page1.png', fullPage: true });

    // Click next page
    const nextBtn = page.locator('[data-testid="pagination-next"]');
    await nextBtn.click();

    // Should show "Page 2 of 2"
    await expect(pagination.getByText(/Page 2 of 2/)).toBeVisible({ timeout: 5000 });

    // Page 2 should have 5 items
    const itemsPage2 = requestList.locator('[role="button"]');
    await expect(itemsPage2).toHaveCount(5, { timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/pagination-page2.png', fullPage: true });

    // Click prev to go back to page 1
    const prevBtn = page.locator('[data-testid="pagination-prev"]');
    await prevBtn.click();
    await expect(pagination.getByText(/Page 1 of 2/)).toBeVisible({ timeout: 5000 });

    // Pagination buttons should be branded (border-2, square)
    const nextBorderWidth = await nextBtn.evaluate((el) => getComputedStyle(el).borderWidth);
    expect(nextBorderWidth).toBe('2px');
    const nextBorderRadius = await nextBtn.evaluate((el) => getComputedStyle(el).borderRadius);
    expect(nextBorderRadius).toBe('0px');
  });
});

test.describe('Detail Tabs Content', () => {
  test('tabs show correct content for different request types', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Tabs WH');
    await navigateToEndpoint(page, 'Tabs WH');

    const endpointId = getEndpointIdFromUrl(page);

    // Send a POST with JSON body and query params
    await fetch(`${API_BASE}/w/${endpointId}?foo=bar&baz=qux`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'test-value' },
      body: JSON.stringify({ message: 'hello', nested: { key: 'value' } }),
    }).catch(() => {});

    // Wait for request to appear
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(requestList.locator('[role="button"]').first()).toBeVisible({ timeout: 10000 });

    // Click it
    await requestList.locator('[role="button"]').first().click();

    // Header tab — should show Host KV row
    await expect(page.locator('text=Host').first()).toBeVisible({ timeout: 5000 });

    // Query tab — should show foo=bar, baz=qux
    await page.getByRole('button', { name: 'QUERY' }).click();
    await expect(page.locator('text=foo').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=bar').first()).toBeVisible({ timeout: 5000 });

    // Body tab — should show pretty JSON
    await page.getByRole('button', { name: 'BODY' }).click();
    await expect(page.locator('text=message').first()).toBeVisible({ timeout: 5000 });

    // Response tab — should show status code
    await page.getByRole('button', { name: 'RESPONSE' }).click();
    await expect(page.locator('text=Status').first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'e2e/screenshots/tabs-response.png', fullPage: true });
  });
});
