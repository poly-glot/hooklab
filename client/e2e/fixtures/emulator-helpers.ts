import { Page, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
const PROJECT_ID = 'demo-webhook';

/**
 * Login as guest via the UI.
 * Navigates to /auth, clicks "Continue as Guest", waits for dashboard.
 */
export async function loginAsGuest(page: Page): Promise<void> {
  await page.goto('/auth');
  // click() auto-waits for visibility — no separate expect needed
  await page.getByText('Guest').click({ timeout: 15000 });
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  await expect(
    page.getByRole('button', { name: /ADD NEW/i }).first()
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Create an endpoint via the dashboard UI.
 */
export async function createEndpointViaUI(page: Page, name: string): Promise<void> {
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

/**
 * Navigate to an endpoint detail page by clicking its card.
 */
export async function navigateToEndpoint(page: Page, name: string): Promise<void> {
  await page.getByText(name).click();
  await page.waitForURL('**/dashboard/endpoint/**', { timeout: 10000 });
  await expect(page.locator('[data-testid="back-button"]')).toBeVisible({ timeout: 10000 });
}

/**
 * Navigate to the script editor from the endpoint detail page.
 */
export async function navigateToScriptEditor(page: Page): Promise<void> {
  const scriptEditorBtn = page.getByRole('button', { name: /Script Editor/i });
  await expect(scriptEditorBtn).toBeVisible({ timeout: 5000 });
  await scriptEditorBtn.click();
  await page.waitForURL('**/script', { timeout: 10000 });
}

/**
 * Extract endpoint ID from the current page URL.
 */
export function getEndpointIdFromUrl(page: Page): string {
  const url = page.url();
  const match = url.match(/\/endpoint\/([^/]+)/);
  return match ? match[1] : '';
}

/**
 * Send a webhook request to an endpoint via the Deno API server.
 */
export async function sendWebhook(
  endpointId: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: string }> {
  const method = options.method || 'POST';
  const queryString = options.query
    ? '?' + new URLSearchParams(options.query).toString()
    : '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}/w/${endpointId}${queryString}`, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? (options.body || '{}') : undefined,
  });
  return { status: res.status, body: await res.text() };
}

/**
 * Send multiple webhook requests to populate the request log.
 */
export async function sendWebhookRequests(
  endpointId: string,
  count: number
): Promise<void> {
  const methods = ['POST', 'GET', 'PUT', 'DELETE', 'PATCH'];
  for (let i = 0; i < count; i++) {
    const method = methods[i % methods.length];
    await fetch(`${API_BASE}/w/${endpointId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET'
        ? JSON.stringify({ test: true, index: i, data: `request-${i}` })
        : undefined,
    }).catch(() => {});
  }
}

/**
 * Disable an endpoint via the dashboard dropdown menu.
 */
export async function disableEndpointViaUI(page: Page, name: string): Promise<void> {
  const card = page.locator('.webhook-card', { hasText: name }).first();
  await card.getByLabel('Options').click();
  await page.getByRole('menuitem', { name: 'Disable' }).click();
  await expect(card.getByText('Closed')).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for the sidebar request list to show at least N items.
 */
export async function waitForRequests(page: Page, count: number): Promise<void> {
  const requestList = page.locator('[data-testid="request-list"]');
  await expect(
    requestList.locator('[role="button"]')
  ).toHaveCount(count, { timeout: 15000 });
}

/**
 * Clear all Firestore emulator data.
 */
export async function clearFirestoreData(): Promise<void> {
  // Use the named "hooklab" database — matches firebase-init.ts and firebase.json.
  // Using "(default)" would silently clear nothing since the app writes to "hooklab".
  await fetch(
    `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/hooklab/documents`,
    { method: 'DELETE' }
  ).catch(() => {});
}

/**
 * Clear all Firebase Auth emulator accounts.
 */
export async function clearAuthData(): Promise<void> {
  await fetch(
    `http://${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' }
  ).catch(() => {});
}

/**
 * Clear all emulator data (auth + firestore).
 */
export async function clearAllEmulatorData(): Promise<void> {
  await Promise.all([clearFirestoreData(), clearAuthData()]);
}
