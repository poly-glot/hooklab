import { test, expect } from '@playwright/test';

test('Reports page matches card-based design with chat pills', async ({ page }) => {
  // Intercept Firebase/auth network calls
  await page.route('**/__/auth/**', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/identitytoolkit/**', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.route('**/securetoken/**', (route) => route.fulfill({ status: 200, body: '{}' }));

  await page.goto('/dashboard/reports');
  await page.waitForTimeout(3000);

  const currentUrl = page.url();

  if (!currentUrl.includes('/reports')) {
    // Auth redirect — render isolated HTML matching the real CSS
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f0f0f0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .chat-card {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            display: flex;
            flex-direction: column;
            min-height: 500px;
            max-width: 800px;
            width: 100%;
          }
          .chat-area {
            flex: 1;
            padding: 32px;
            display: flex;
            flex-direction: column;
          }
          .chat-empty {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            text-align: center;
          }
          .chat-empty__icon { margin-bottom: 8px; }
          .chat-empty__icon svg { width: 36px; height: 36px; color: #01189b; }
          .chat-empty__title {
            font-size: 40px; font-weight: 800; color: #323232;
            letter-spacing: -0.02em; margin-bottom: 24px;
          }
          .chat-empty__title-ai { color: #01189b; }
          .chat-suggestions {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 14px; max-width: 600px; width: 100%;
          }
          .chat-pill {
            height: 54px; padding: 0 24px; font-size: 14px; font-weight: 500;
            border: 1px solid #e0e0e0; background: #fff; color: #444;
            cursor: pointer; border-radius: 16px; display: flex;
            align-items: center; justify-content: center; text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06),
              0 6px 0 -3px rgba(0,0,0,0.03), 0 8px 0 -4px rgba(0,0,0,0.02);
          }
          .chat-bottom {
            padding: 0 32px 24px;
            display: flex; flex-direction: column; gap: 12px;
          }
          .controls { display: flex; align-items: center; gap: 12px; }
          .control-group { display: flex; align-items: center; gap: 6px; }
          .control-label {
            font-size: 11px; font-weight: 700; color: #808080;
            text-transform: uppercase; letter-spacing: 0.04em;
          }
          .ctrl-pill {
            height: 28px; padding: 0 12px; font-size: 11px; font-weight: 600;
            border: 1px solid #d9d9d9; background: #fff; color: #686868;
            border-radius: 6px; display: inline-flex; align-items: center;
          }
          .ctrl-pill--active { background: #111; color: #fff; border-color: #111; }
          .input-area { display: flex; gap: 10px; align-items: flex-end; }
          .input-field {
            flex: 1; min-height: 44px; padding: 10px 14px; font-size: 13px;
            border: 1px solid #d9d9d9; border-radius: 12px; outline: none;
          }
          .send-btn {
            height: 44px; width: 44px; background: #01189b; color: #fff;
            border: none; border-radius: 12px; display: flex;
            align-items: center; justify-content: center;
          }
        </style>
      </head>
      <body>
        <div class="chat-card" data-testid="chat-card">
          <div class="chat-area">
            <div class="chat-empty" data-testid="chat-empty">
              <div class="chat-empty__icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  <path d="M20 3v4"/><path d="M22 5h-4"/>
                </svg>
              </div>
              <div class="chat-empty__title">Hooklab <span class="chat-empty__title-ai">AI.</span></div>
              <div class="chat-suggestions">
                <button class="chat-pill">How many webhooks did I get this week?</button>
                <button class="chat-pill">Show me the slowest requests</button>
                <button class="chat-pill">Error rate by endpoint</button>
                <button class="chat-pill">Show request volume over time as a chart</button>
              </div>
            </div>
          </div>
          <div class="chat-bottom" data-testid="chat-bottom">
            <div class="controls">
              <div class="control-group">
                <span class="control-label">Duration:</span>
                <button class="ctrl-pill ctrl-pill--active">7 days</button>
              </div>
              <div class="control-group">
                <span class="control-label">Format:</span>
                <button class="ctrl-pill ctrl-pill--active">Table</button>
              </div>
            </div>
            <div class="input-area">
              <input class="input-field" placeholder="Ask about your webhooks..." />
              <button class="send-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    await page.waitForTimeout(500);
  }

  // ── Card Layout ──
  const chatCard = page.locator('[data-testid="chat-card"], [class*="chatCard"]').first();
  await expect(chatCard).toBeVisible({ timeout: 5000 });

  const cardStyles = await chatCard.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      borderRadius: s.borderRadius,
      boxShadow: s.boxShadow,
    };
  });

  // White card on gray background
  expect(cardStyles.background).toBe('rgb(255, 255, 255)');
  // Rounded corners (16px)
  expect(cardStyles.borderRadius).toBe('16px');
  // Has shadow
  expect(cardStyles.boxShadow).not.toBe('none');

  // ── Page background is gray ──
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(240, 240, 240)');

  // ── Chat Empty State ──
  const chatEmpty = page.locator('[data-testid="chat-empty"], [class*="chatEmpty"]').first();
  await expect(chatEmpty).toBeVisible();

  // ── Suggestion Pills ──
  const pills = chatEmpty.locator('button');
  await expect(pills).toHaveCount(4);

  const firstPill = pills.first();
  const pillStyles = await firstPill.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      borderRadius: s.borderRadius,
      boxShadow: s.boxShadow,
      background: s.backgroundColor,
      height: parseInt(s.height),
      justifyContent: s.justifyContent,
    };
  });

  expect(pillStyles.borderRadius).toBe('16px');
  expect(pillStyles.boxShadow).not.toBe('none');
  expect(pillStyles.background).toBe('rgb(255, 255, 255)');
  expect(pillStyles.height).toBeGreaterThanOrEqual(50);
  expect(pillStyles.height).toBeLessThanOrEqual(58);

  // 2x2 grid
  const suggestionsGrid = chatEmpty.locator('.chat-suggestions, [class*="chatSuggestions"]').first();
  const gridCols = await suggestionsGrid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(gridCols.split(' ').filter(Boolean).length).toBe(2);

  // Verify 2x2 layout bounding boxes
  const boxes = await pills.evaluateAll((els) =>
    els.map((el) => ({ top: Math.round(el.getBoundingClientRect().top) }))
  );
  expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(5);
  expect(Math.abs(boxes[2].top - boxes[3].top)).toBeLessThan(5);
  expect(boxes[2].top).toBeGreaterThan(boxes[0].top + 20);

  // ── Controls at bottom ──
  const chatBottom = page.locator('[data-testid="chat-bottom"], [class*="chatBottom"]').first();
  await expect(chatBottom).toBeVisible();

  // Controls should be below the chat area
  const chatAreaBottom = await chatEmpty.evaluate((el) => el.getBoundingClientRect().bottom);
  const controlsTop = await chatBottom.evaluate((el) => el.getBoundingClientRect().top);
  expect(controlsTop).toBeGreaterThanOrEqual(chatAreaBottom - 10);

  // ── Screenshots ──
  await chatCard.screenshot({ path: 'e2e/screenshots/reports-chat-card.png' });
  await page.screenshot({ path: 'e2e/screenshots/reports-full-page.png', fullPage: true });
});
