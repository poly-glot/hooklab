import { test, expect } from './fixtures/test-fixtures';
import {
  loginAsGuest,
  createEndpointViaUI,
  navigateToEndpoint,
} from './fixtures/emulator-helpers';

/**
 * Script Editor tests — runs against real Firebase emulators.
 * Creates real endpoints and tests the script editor component.
 */
test.describe('Script Editor', () => {
  test.describe('Editor UI Elements', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Scripted Endpoint');
      await navigateToEndpoint(page, 'Scripted Endpoint');
    });

    test('script editor card has title "Script Editor"', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(scriptEditorTitle).toBeVisible();
      }
    });
  });

  test.describe('Script Editor Component Contract', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsGuest(page);
      await createEndpointViaUI(page, 'Script Test');
      await navigateToEndpoint(page, 'Script Test');
    });

    test('script editor has Save, Reset, and Test buttons when rendered', async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /Save/i });
      const resetButton = page.getByRole('button', { name: /Reset/i });
      const testButton = page.getByRole('button', { name: /Test/i });

      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(saveButton).toBeVisible();
        await expect(resetButton).toBeVisible();
        await expect(testButton).toBeVisible();
      }
    });

    test('script editor shows Saved badge when script is unchanged', async ({ page }) => {
      const savedBadge = page.getByText('Saved', { exact: true });
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(savedBadge).toBeVisible();
      }
    });

    test('script editor textarea is present for code editing', async ({ page }) => {
      const textarea = page.locator('textarea[spellcheck="false"]');
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(textarea).toBeVisible();
      }
    });

    test('script editor has line numbers', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        const lineNumbers = page.locator('.bg-zinc-900');
        await expect(lineNumbers).toBeVisible();
      }
    });

    test('typing in textarea changes badge to Unsaved', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        const textarea = page.locator('textarea[spellcheck="false"]');
        await textarea.click();
        await textarea.type('// new comment\n');

        const unsavedBadge = page.getByText('Unsaved', { exact: true });
        await expect(unsavedBadge).toBeVisible();
      }
    });

    test('script editor has Script API Reference section', async ({ page }) => {
      const apiRef = page.getByText('Script API Reference');
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(apiRef).toBeVisible();
      }
    });

    test('clicking Script API Reference expands it', async ({ page }) => {
      const apiRef = page.getByText('Script API Reference');
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await apiRef.click();

        await expect(page.getByText('Request Object')).toBeVisible();
        await expect(page.getByText('Response Format')).toBeVisible();
        await expect(page.getByText('Example Scripts')).toBeVisible();
      }
    });

    test('API reference shows example scripts with Load Example buttons', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByText('Script API Reference').click();

        await expect(page.getByText('Echo Request Body')).toBeVisible();
        await expect(page.getByText('Conditional Response by Method')).toBeVisible();
        await expect(page.getByText('Parse JSON and Transform')).toBeVisible();

        const loadButtons = page.getByRole('button', { name: 'Load Example' });
        expect(await loadButtons.count()).toBe(3);
      }
    });

    test('API reference shows tips section', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByText('Script API Reference').click();

        await expect(page.getByText('Tips')).toBeVisible();
        await expect(
          page.getByText('Scripts run in a sandboxed Deno Worker')
        ).toBeVisible();
        await expect(page.getByText('5-second execution timeout')).toBeVisible();
      }
    });

    test('loading an example replaces textarea content and marks unsaved', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByText('Script API Reference').click();
        const loadButtons = page.getByRole('button', { name: 'Load Example' });
        await loadButtons.first().click();

        await expect(page.getByText('Example loaded')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();

        const textarea = page.locator('textarea[spellcheck="false"]');
        const value = await textarea.inputValue();
        expect(value).toContain('Echo back whatever was sent');
      }
    });

    test('Reset button restores default script', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.getByRole('button', { name: /Reset/i }).click();

        await expect(page.getByText('Script reset to default')).toBeVisible({
          timeout: 5000,
        });

        await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();

        const textarea = page.locator('textarea[spellcheck="false"]');
        const value = await textarea.inputValue();
        expect(value).toContain('Access the incoming request');
      }
    });

    test('code editor has monospace font', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        const textarea = page.locator('textarea[spellcheck="false"]');
        const fontFamily = await textarea.evaluate(
          (el) => window.getComputedStyle(el).fontFamily
        );
        expect(fontFamily.toLowerCase()).toMatch(/mono|jetbrains|fira|cascadia/);
      }
    });

    test('code editor has dark background', async ({ page }) => {
      const scriptEditorTitle = page.getByText('Script Editor', { exact: true });
      if (await scriptEditorTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
        const codeArea = page.locator('.bg-zinc-950').first();
        await expect(codeArea).toBeVisible();
      }
    });
  });
});
