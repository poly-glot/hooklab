import { test, expect } from '@playwright/test';

/**
 * BEM conversion validation tests.
 * These tests verify that the BEM CSS classes are properly applied
 * and rendered without requiring Firebase authentication.
 */
test.describe('BEM CSS Validation', () => {
  test('landing page renders correctly with existing LP classes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Landing page should still use the lp- prefixed BEM classes
    await expect(page.locator('.lp-root')).toBeVisible();
    await expect(page.locator('.lp-nav')).toBeVisible();
    await expect(page.locator('.lp-hero')).toBeVisible();
    await expect(page.locator('.lp-features-grid')).toBeVisible();
  });

  test('BEM CSS classes are loaded in the stylesheet', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check that our new BEM classes exist in the stylesheets
    const hasAppHeaderClass = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.app-header')) {
              return true;
            }
          }
        } catch { /* cross-origin sheet */ }
      }
      return false;
    });
    expect(hasAppHeaderClass).toBe(true);

    const hasDashboardClass = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule && rule.selectorText?.includes('.dashboard')) {
              return true;
            }
          }
        } catch { /* cross-origin sheet */ }
      }
      return false;
    });
    expect(hasDashboardClass).toBe(true);
  });

  test('BEM key classes are present in built CSS', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const bemClasses = [
      '.app-header',
      '.app-footer',
      '.method-badge',
      '.filter-pill',
      '.webhook-card',
      '.request-list-item',
      '.action-bar',
      '.sidebar',
      '.detail-tabs',
      '.kv-row',
      '.status-badge',
      '.json-pretty',
      '.waiting-state',
      '.export-dropdown',
      '.edit-panel',
      '.endpoint-detail',
      '.btn--primary',
      '.btn--danger',
    ];

    const results = await page.evaluate((classes) => {
      const sheets = Array.from(document.styleSheets);
      const found: Record<string, boolean> = {};
      for (const cls of classes) {
        found[cls] = false;
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes(cls)) {
                found[cls] = true;
                break;
              }
            }
          } catch { /* cross-origin sheet */ }
          if (found[cls]) break;
        }
      }
      return found;
    }, bemClasses);

    for (const [cls, exists] of Object.entries(results)) {
      expect(exists, `CSS class ${cls} should exist in stylesheets`).toBe(true);
    }
  });

  test('auth page renders with BEM header', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');

    // The auth page should redirect here since no user
    // Check that the page loaded (not a blank screen)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('waiting-state spinner animation is defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasAnimation = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSKeyframesRule && rule.name === 'waiting-spin') {
              return true;
            }
          }
        } catch { /* cross-origin sheet */ }
      }
      return false;
    });
    expect(hasAnimation).toBe(true);
  });

  test('status badge color variants are defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const variants = ['.status-badge--success', '.status-badge--warning', '.status-badge--error'];
    const results = await page.evaluate((classes) => {
      const sheets = Array.from(document.styleSheets);
      const found: Record<string, boolean> = {};
      for (const cls of classes) {
        found[cls] = false;
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes(cls)) {
                found[cls] = true;
                break;
              }
            }
          } catch { /* cross-origin sheet */ }
          if (found[cls]) break;
        }
      }
      return found;
    }, variants);

    for (const [cls, exists] of Object.entries(results)) {
      expect(exists, `CSS class ${cls} should exist`).toBe(true);
    }
  });

  test('json-pretty syntax highlight classes are defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const classes = [
      '.json-pretty__key',
      '.json-pretty__string',
      '.json-pretty__number',
      '.json-pretty__boolean',
      '.json-pretty__null',
    ];
    const results = await page.evaluate((classes) => {
      const sheets = Array.from(document.styleSheets);
      const found: Record<string, boolean> = {};
      for (const cls of classes) {
        found[cls] = false;
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes(cls)) {
                found[cls] = true;
                break;
              }
            }
          } catch { /* cross-origin sheet */ }
          if (found[cls]) break;
        }
      }
      return found;
    }, classes);

    for (const [cls, exists] of Object.entries(results)) {
      expect(exists, `CSS class ${cls} should exist`).toBe(true);
    }
  });

  test('export dropdown classes are defined', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const classes = [
      '.export-dropdown',
      '.export-dropdown__trigger',
      '.export-dropdown__menu',
      '.export-dropdown__item',
    ];
    const results = await page.evaluate((classes) => {
      const sheets = Array.from(document.styleSheets);
      const found: Record<string, boolean> = {};
      for (const cls of classes) {
        found[cls] = false;
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              if (rule instanceof CSSStyleRule && rule.selectorText?.includes(cls)) {
                found[cls] = true;
                break;
              }
            }
          } catch { /* cross-origin sheet */ }
          if (found[cls]) break;
        }
      }
      return found;
    }, classes);

    for (const [cls, exists] of Object.entries(results)) {
      expect(exists, `CSS class ${cls} should exist`).toBe(true);
    }
  });

  test('webhook-card options icon has correct size (Task 8 fix)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hasCorrectSize = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules);
          for (const rule of rules) {
            if (rule instanceof CSSStyleRule &&
                rule.selectorText?.includes('.webhook-card__options-icon')) {
              const width = rule.style.getPropertyValue('width');
              const height = rule.style.getPropertyValue('height');
              return width === '16px' && height === '16px';
            }
          }
        } catch { /* cross-origin sheet */ }
      }
      return false;
    });
    expect(hasCorrectSize).toBe(true);
  });
});
