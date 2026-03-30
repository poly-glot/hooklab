import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
  sendWebhookRequests,
} from './fixtures/emulator-helpers';

test.describe('Sidebar Requests', () => {
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

    // Switch to Body tab
    await bodyTab.click();
    await expect(page.locator('text=test').first()).toBeVisible({ timeout: 5000 });

    // Switch to Response tab
    await responseTab.click();
    await expect(page.locator('text=Status').first()).toBeVisible({ timeout: 5000 });
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

    // Wait for pagination to appear (all 25 requests arrived)
    const pagination = page.locator('[data-testid="pagination"]');
    await expect(pagination).toBeVisible({ timeout: 5000 });

    // Should show "Page 1 of 2"
    await expect(pagination.getByText(/Page 1 of 2/)).toBeVisible({ timeout: 5000 });

    // Page 1 should have 20 items
    const itemsPage1 = requestList.locator('[role="button"]');
    await expect(itemsPage1).toHaveCount(20, { timeout: 5000 });

    // Click next page
    const nextBtn = page.locator('[data-testid="pagination-next"]');
    await nextBtn.click();

    // Should show "Page 2 of 2"
    await expect(pagination.getByText(/Page 2 of 2/)).toBeVisible({ timeout: 5000 });

    // Page 2 should have 5 items
    const itemsPage2 = requestList.locator('[role="button"]');
    await expect(itemsPage2).toHaveCount(5, { timeout: 5000 });

    // Click prev to go back to page 1
    const prevBtn = page.locator('[data-testid="pagination-prev"]');
    await prevBtn.click();
    await expect(pagination.getByText(/Page 1 of 2/)).toBeVisible({ timeout: 5000 });
  });
});

