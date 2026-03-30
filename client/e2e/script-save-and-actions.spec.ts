import { test, expect } from '@playwright/test';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
  getEndpointIdFromUrl,
  navigateToScriptEditor,
} from './fixtures/emulator-helpers';

const API_BASE = process.env.API_URL || 'http://localhost:3000';

test.describe('Script Editor - Save Custom Script', () => {
  test('write custom script and save', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'ScriptSave Endpoint');
    await navigateToEndpoint(page, 'ScriptSave Endpoint');
    await navigateToScriptEditor(page);

    const textarea = page.locator('textarea[spellcheck="false"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    await textarea.fill(
      'return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({custom: true}) };'
    );

    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible({ timeout: 3000 });

    const saveBtn = page.getByRole('button', { name: /Save/i });
    await saveBtn.click();

    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Script saved')).toBeVisible({ timeout: 5000 });
  });

  test('saved script executes on webhook call', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'ScriptExec Endpoint');
    await navigateToEndpoint(page, 'ScriptExec Endpoint');

    const endpointId = getEndpointIdFromUrl(page);

    await navigateToScriptEditor(page);

    const textarea = page.locator('textarea[spellcheck="false"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(
      'return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({custom: true}) };'
    );

    const saveBtn = page.getByRole('button', { name: /Save/i });
    await saveBtn.click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10000 });

    // Call the webhook endpoint directly and verify the custom script response
    const response = await fetch(`${API_BASE}/w/${endpointId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });

    expect(response.status).toBe(201);
    const body = await response.text();
    expect(body).toContain('custom');
  });

  test('test button executes script and shows result', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'ScriptTest Endpoint');
    await navigateToEndpoint(page, 'ScriptTest Endpoint');
    await navigateToScriptEditor(page);

    const testBtn = page.getByRole('button', { name: /Test/i });
    await expect(testBtn).toBeVisible({ timeout: 5000 });
    await testBtn.click();

    // Test shows a "Test completed" toast
    await expect(page.getByText('Test completed')).toBeVisible({ timeout: 15000 });
  });

  test('reset button restores default script', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'ScriptReset Endpoint');
    await navigateToEndpoint(page, 'ScriptReset Endpoint');
    await navigateToScriptEditor(page);

    const textarea = page.locator('textarea[spellcheck="false"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Modify the textarea
    await textarea.fill('// modified script');
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible({ timeout: 3000 });

    // Click Reset
    const resetBtn = page.getByRole('button', { name: /Reset/i });
    await resetBtn.click();

    await expect(page.getByText('Script reset to default')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Unsaved', { exact: true })).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Copy URL Button', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions for copy tests
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'CopyURL Endpoint');
    await navigateToEndpoint(page, 'CopyURL Endpoint');
  });

  test('clicking copy shows toast notification', async ({ page }) => {
    const copyBtn = page.getByText('Copy').first();
    await copyBtn.click();

    // Verify the sonner toast appears with the expected message
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Webhook URL copied')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Refresh Button', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Refresh Endpoint');
    await navigateToEndpoint(page, 'Refresh Endpoint');
  });

  test('clicking refresh shows Refreshed toast', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i });
    await refreshBtn.click();

    await expect(page.getByText('Refreshed')).toBeVisible({ timeout: 5000 });
  });
});
