import { test, expect, type Page } from '@playwright/test';

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
}

test.describe('Mobile Viewport (375x667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('landing page loads on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Verify the page renders visible content (header or hero text)
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Check that some meaningful content is rendered
    const hasContent = await page.locator('h1, h2, header, [class*="hero"], [class*="landing"]').first().isVisible().catch(() => false);
    expect(hasContent || await page.locator('body').innerText().then(t => t.trim().length > 0)).toBeTruthy();
  });

  test('auth page works on mobile', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    const guestButton = page.getByText('Guest');
    await expect(guestButton).toBeVisible({ timeout: 10000 });
    // Verify the button is within the visible viewport and clickable
    await expect(guestButton).toBeEnabled();
  });

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

    // Verify the endpoint detail page loaded (back button or endpoint name visible)
    const backButton = page.getByText('Back to listing');
    const endpointName = page.getByText('Mobile Detail EP');
    const hasBack = await backButton.isVisible().catch(() => false);
    const hasName = await endpointName.isVisible().catch(() => false);
    expect(hasBack || hasName).toBeTruthy();
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

  test('dashboard works on tablet', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Tablet Dashboard EP');
    await expect(page.getByText('Tablet Dashboard EP')).toBeVisible();
  });

  test('endpoint detail works on tablet', async ({ page }) => {
    await loginAsGuest(page);
    await createEndpointViaUI(page, 'Tablet Detail EP');
    await navigateToEndpoint(page, 'Tablet Detail EP');

    // Verify the action bar area is visible on tablet
    const actionBar = page.locator('.action-bar__toolbar-mobile, .action-bar__toolbar');
    await expect(actionBar.first()).toBeVisible({ timeout: 5000 });
  });

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
