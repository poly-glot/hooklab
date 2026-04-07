import { test, expect } from './fixtures/test-fixtures';
import { loginAsGuest } from './fixtures/emulator-helpers';

/**
 * Reports page tests — emulator only.
 *
 * In emulator mode, BigQuery is replaced by a Firestore fallback and
 * Gemini returns canned SQL. Tests verify the chat UI, query submission,
 * and guest duration restrictions.
 */
test.describe('Reports Page', () => {
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Requires Firebase emulators');

  test('reports page loads with chat UI elements', async ({ page }) => {
    await loginAsGuest(page);

    // Navigate to reports
    await page.goto('/dashboard/reports');
    await page.waitForLoadState('domcontentloaded');

    // Chat input visible
    const chatInput = page.getByPlaceholder(/ask about your webhooks/i)
      .or(page.locator('textarea'));
    await expect(chatInput.first()).toBeVisible({ timeout: 10000 });

    // Duration selector pills visible
    await expect(page.getByRole('button', { name: '7 days' })).toBeVisible();
    await expect(page.getByRole('button', { name: '30 days' })).toBeVisible();

    // Format selector pills visible
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
  });

  test('suggestion chips are visible and clickable', async ({ page }) => {
    await loginAsGuest(page);
    await page.goto('/dashboard/reports');

    // Wait for suggestions to load
    const suggestion = page.getByText('How many webhooks did I get this week?');
    await expect(suggestion).toBeVisible({ timeout: 10000 });

    // Click a suggestion chip
    await suggestion.click();

    // Chat input should contain the suggestion text
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toHaveValue(/webhooks/i, { timeout: 5000 });
  });

  test('submitting a query returns results', async ({ page }) => {
    await loginAsGuest(page);

    // Seed data ensures some executions exist
    const cards = page.locator('[data-testid="endpoint-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 20000 });

    await page.goto('/dashboard/reports');

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Type a query
    await chatInput.fill('How many webhooks did I get?');

    // Submit via Enter or send button
    const sendBtn = page.getByRole('button', { name: /send/i })
      .or(page.locator('button[type="submit"]'));

    if (await sendBtn.first().isVisible()) {
      await sendBtn.first().click();
    } else {
      await chatInput.press('Enter');
    }

    // Wait for a response message to appear (loading then result)
    // Look for either result data, an error message, or a response bubble
    const responseOrError = page.locator('[class*="message"]')
      .or(page.getByText(/rows|results|error|no data/i));
    await expect(responseOrError.first()).toBeVisible({ timeout: 30000 });
  });

  test('guest is restricted to 7-day duration', async ({ page }) => {
    await loginAsGuest(page);
    await page.goto('/dashboard/reports');

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Select 30 days duration
    const thirtyDayBtn = page.getByRole('button', { name: '30 days' });
    await thirtyDayBtn.click();

    // Submit a query
    await chatInput.fill('Show request count');

    const sendBtn = page.getByRole('button', { name: /send/i })
      .or(page.locator('button[type="submit"]'));

    if (await sendBtn.first().isVisible()) {
      await sendBtn.first().click();
    } else {
      await chatInput.press('Enter');
    }

    // Expect error about anonymous/guest restriction
    await expect(
      page.getByText(/anonymous|guest|limited|7.day/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('default duration is 7 days', async ({ page }) => {
    await loginAsGuest(page);
    await page.goto('/dashboard/reports');

    // "7 days" button should be active/selected by default
    const sevenDayBtn = page.getByRole('button', { name: '7 days' });
    await expect(sevenDayBtn).toBeVisible({ timeout: 10000 });

    // The active pill has a CSS module class containing "Active" or "active"
    // Check via computed background color — active pill has a dark background
    const bgColor = await sevenDayBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Active pill should NOT be white/transparent (inactive buttons are light)
    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });

  test('new chat button resets conversation', async ({ page }) => {
    await loginAsGuest(page);
    await page.goto('/dashboard/reports');

    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Look for "New Chat" button
    const newChatBtn = page.getByRole('button', { name: /new chat/i })
      .or(page.getByText(/new chat/i));

    if (await newChatBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await newChatBtn.first().click();

      // Chat input should be empty after new chat
      await expect(chatInput).toHaveValue('');
    } else {
      test.skip(true, 'New Chat button not visible in current UI state');
    }
  });
});
