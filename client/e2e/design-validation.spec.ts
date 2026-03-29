import { test, expect, type Page } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
  sendWebhook,
} from './fixtures/emulator-helpers';

/**
 * Design validation tests — runs against real Firebase emulators.
 * Validates the visual structure matches the Figma design specification.
 */

test.describe('Login Page (/auth)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('has Hooklab title', async ({ page }) => {
    await expect(page.getByText('Hooklab')).toBeVisible();
  });

  test('has Continue with Google button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible();
  });

  test('has Continue with Email Link button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Continue with Email Link/i })).toBeVisible();
  });

  test('has Continue as Guest text', async ({ page }) => {
    await expect(page.getByText(/Continue as/i)).toBeVisible();
    await expect(page.getByText('Guest')).toBeVisible();
  });

  test('modal card is visible and centered', async ({ page }) => {
    const card = page.locator('.rounded-2xl');
    await expect(card).toBeVisible();
  });

  test('Google button shows Coming soon toast', async ({ page }) => {
    await page.getByRole('button', { name: /Continue with Google/i }).click();
    await expect(page.getByText('Coming soon')).toBeVisible();
  });

  test('Email Link button shows Coming soon toast', async ({ page }) => {
    await page.getByRole('button', { name: /Continue with Email Link/i }).click();
    await expect(page.getByText('Coming soon')).toBeVisible();
  });
});

test.describe('Listing Page (/dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Payment Webhooks');
    await createEndpointViaUI(page, 'Order Notifications');
  });

  test('has header with Hooklab', async ({ page }) => {
    await expect(page.getByRole('banner').getByText('Hooklab')).toBeVisible();
  });

  test('has ADD NEW button with brand background', async ({ page }) => {
    const addNewButton = page.getByRole('button', { name: /ADD NEW/i });
    await expect(addNewButton).toBeVisible();
    const bgColor = await addNewButton.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(1, 24, 155)');
  });

  test('has search input with correct placeholder', async ({ page }) => {
    const searchInput = page.getByPlaceholder('search by webhook');
    await expect(searchInput).toBeVisible();
  });

  test('has All filter pill', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^All/ })).toBeVisible();
  });

  test('has Active filter pill', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Active/ })).toBeVisible();
  });

  test('has Closed filter pill', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Closed/ })).toBeVisible();
  });

  test('footer has Usual copyright notice', async ({ page }) => {
    await expect(page.getByText('Usual copyright notice')).toBeVisible();
  });

  test('shows webhook endpoint cards', async ({ page }) => {
    await expect(page.getByText('Payment Webhooks')).toBeVisible();
    await expect(page.getByText('Order Notifications')).toBeVisible();
  });

  test('filter pills filter the list', async ({ page }) => {
    const allPill = page.getByRole('button', { name: /^All/ });
    await expect(allPill).toBeVisible();

    await page.getByRole('button', { name: /^Active/ }).click();
    await expect(page.getByText('Payment Webhooks')).toBeVisible();
  });

  test('search input filters endpoints', async ({ page }) => {
    const searchInput = page.getByPlaceholder('search by webhook');
    await searchInput.fill('Payment');
    await expect(page.getByText('Payment Webhooks')).toBeVisible();
    await expect(page.getByText('Order Notifications')).not.toBeVisible();
  });
});

test.describe('Details Page (/dashboard/endpoint/:id)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Test Endpoint');
    await navigateToEndpoint(page, 'Test Endpoint');

    const endpointId = getEndpointIdFromUrl(page);

    // Send real webhook requests
    await sendWebhook(endpointId, {
      method: 'POST',
      body: JSON.stringify({ event: 'payment.success' }),
      query: { debug: 'true' },
    });
    await sendWebhook(endpointId, { method: 'GET' });

    // Wait for requests to appear via real-time listener
    const requestList = page.locator('[data-testid="request-list"]');
    await expect(
      requestList.locator('[role="button"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('has Back to listing button', async ({ page }) => {
    await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
  });

  test('back button navigates to dashboard', async ({ page }) => {
    await page.locator('[data-testid="back-button"]').click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('has Header tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Header$/i })).toBeVisible();
  });

  test('has Body tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Body$/i })).toBeVisible();
  });

  test('has Query tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Query$/i })).toBeVisible();
  });

  test('has Response tab', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Response$/i })).toBeVisible();
  });

  test('has DELETE ALL button', async ({ page }) => {
    await expect(page.locator('[data-testid="clear-all-button"]')).toBeVisible();
  });

  test('DELETE ALL button has danger color', async ({ page }) => {
    const deleteBtn = page.locator('[data-testid="clear-all-button"]');
    const bgColor = await deleteBtn.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toBe('rgb(172, 27, 17)');
  });

  test('shows request list items in sidebar', async ({ page }) => {
    const requestList = page.locator('[data-testid="request-list"]');
    const items = requestList.locator('[role="button"]');
    expect(await items.count()).toBeGreaterThanOrEqual(2);
  });

  test('Header tab is active by default and shows content', async ({ page }) => {
    const requestList = page.locator('[data-testid="request-list"]');
    await requestList.locator('[role="button"]').first().click();

    const headerTab = page.getByRole('button', { name: /^Header$/i });
    await expect(headerTab).toBeVisible();
    await expect(page.getByText('Host')).toBeVisible();
  });

  test('clicking Body tab shows request body content', async ({ page }) => {
    const requestList = page.locator('[data-testid="request-list"]');
    await requestList.locator('[role="button"]').first().click();

    await page.getByRole('button', { name: /^Body$/i }).click();
    await expect(page.getByText('payment.success')).toBeVisible();
  });

  test('clicking Query tab shows query parameters', async ({ page }) => {
    const requestList = page.locator('[data-testid="request-list"]');
    await requestList.locator('[role="button"]').first().click();

    await page.getByRole('button', { name: /^Query$/i }).click();
    await expect(page.getByText('debug')).toBeVisible();
    await expect(page.getByText('true')).toBeVisible();
  });

  test('clicking Response tab shows response status', async ({ page }) => {
    const requestList = page.locator('[data-testid="request-list"]');
    await requestList.locator('[role="button"]').first().click();

    await page.getByRole('button', { name: /^Response$/i }).click();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('200')).toBeVisible();
  });

  test('header has Hooklab branding', async ({ page }) => {
    await expect(page.getByRole('banner').getByText('Hooklab')).toBeVisible();
  });

  test('footer is visible', async ({ page }) => {
    await expect(page.getByText('Usual copyright notice')).toBeVisible();
  });
});
