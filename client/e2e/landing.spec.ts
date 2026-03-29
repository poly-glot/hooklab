import { test, expect } from './fixtures/test-fixtures';

test.describe('Landing Page - Guest Journey', () => {
  test.beforeEach(async ({ landingPage }) => {
    await landingPage.goto();
  });

  test.describe('Page Structure', () => {
    test('page loads with all major sections visible', async ({ landingPage }) => {
      await landingPage.expectLoaded();

      await expect(landingPage.nav).toBeVisible();
      await expect(landingPage.heroSection).toBeVisible();
      await expect(landingPage.footer).toBeVisible();
    });

    test('navigation bar displays logo and links', async ({ landingPage }) => {
      await expect(landingPage.navLogo).toHaveText('HOOKLAB');
      await expect(landingPage.featuresLink).toBeVisible();
      await expect(landingPage.scriptingLink).toBeVisible();
      await expect(landingPage.endpointsLink).toBeVisible();
      await expect(landingPage.getStartedNavButton).toBeVisible();
    });

    test('hero section displays correct content', async ({ landingPage }) => {
      await expect(landingPage.heroLabel).toHaveText('WEBHOOK TESTING PLATFORM');
      await expect(landingPage.heroTitle).toContainText('Inspect, debug & transform');
      await expect(landingPage.heroTitle).toContainText('webhooks in real time');
      // Title verified above with "Inspect, debug & transform" and "webhooks in real time"
      await expect(landingPage.heroSubtitle).toContainText('Create unlimited endpoints');
      await expect(landingPage.startTestingButton).toBeVisible();
      await expect(landingPage.seeHowItWorksLink).toBeVisible();
    });

    test('features section displays six feature cards', async ({ landingPage }) => {
      await expect(landingPage.featuresSection).toBeVisible();
      await expect(landingPage.featureCards).toHaveCount(6);
    });

    test('features section shows correct feature titles', async ({ page }) => {
      await expect(page.getByText('Instant Endpoints')).toBeVisible();
      await expect(page.getByText('JavaScript Scripting')).toBeVisible();
      await expect(page.getByText('Sandboxed Execution')).toBeVisible();
      await expect(page.getByText('Deep Inspection')).toBeVisible();
      await expect(page.getByText('Real-time Updates')).toBeVisible();
      await expect(page.getByText('Method Agnostic')).toBeVisible();
    });

    test('scripting section displays script editor mock', async ({ landingPage }) => {
      await expect(landingPage.scriptingSection).toBeVisible();
      await expect(landingPage.tryScriptEditorButton).toBeVisible();
    });

    test('endpoints section displays endpoint cards mock', async ({ landingPage }) => {
      await expect(landingPage.endpointsSection).toBeVisible();
      await expect(landingPage.createFirstEndpointButton).toBeVisible();
    });

    test('how it works section shows three steps', async ({ landingPage }) => {
      await expect(landingPage.steps).toHaveCount(3);
    });

    test('how it works steps have correct content', async ({ page }) => {
      await expect(page.getByText('Create an endpoint')).toBeVisible();
      await expect(page.getByText('Send webhooks')).toBeVisible();
      await expect(page.getByText('Inspect & transform')).toBeVisible();
    });

    test('CTA section displays call to action', async ({ landingPage }) => {
      await expect(landingPage.ctaSection).toBeVisible();
      await expect(landingPage.ctaButton).toBeVisible();
      await expect(landingPage.ctaButton).toContainText('Get Started');
    });

    test('footer displays logo and links', async ({ landingPage, page }) => {
      await expect(landingPage.footer).toBeVisible();
      await expect(landingPage.footerLogo).toHaveText('HOOKLAB');
      await expect(page.locator('.lp-footer-copy')).toContainText('Free and open source');
    });
  });

  test.describe('Navigation', () => {
    test('Get Started button navigates to auth page', async ({ landingPage, page }) => {
      await landingPage.clickGetStarted();
      await expect(page).toHaveURL(/\/auth/);
    });

    test('Start Testing button navigates to auth page', async ({ landingPage, page }) => {
      await landingPage.clickStartTesting();
      await expect(page).toHaveURL(/\/auth/);
    });

    test('Try the Script Editor button navigates to auth page', async ({
      landingPage,
      page,
    }) => {
      await landingPage.clickTryScriptEditor();
      await expect(page).toHaveURL(/\/auth/);
    });

    test('Create Your First Endpoint button navigates to auth page', async ({
      landingPage,
      page,
    }) => {
      await landingPage.clickCreateFirstEndpoint();
      await expect(page).toHaveURL(/\/auth/);
    });

    test('CTA button navigates to auth page', async ({ landingPage, page }) => {
      await landingPage.clickCtaButton();
      await expect(page).toHaveURL(/\/auth/);
    });

    test('Features nav link scrolls to features section', async ({ landingPage }) => {
      await landingPage.scrollToFeatures();
      await expect(landingPage.featuresSection).toBeInViewport();
    });

    test('Scripting nav link scrolls to scripting section', async ({ landingPage }) => {
      await landingPage.scrollToScripting();
      await expect(landingPage.scriptingSection).toBeInViewport();
    });

    test('Endpoints nav link scrolls to endpoints section', async ({ landingPage }) => {
      await landingPage.scrollToEndpoints();
      await expect(landingPage.endpointsSection).toBeInViewport();
    });
  });

  test.describe('Visual Elements', () => {
    test('hero dashboard mock is rendered', async ({ page }) => {
      await expect(page.locator('.lp-hero-mock')).toBeVisible();
      await expect(page.locator('.lp-mock-chrome').first()).toBeVisible();
    });

    test('script editor mock is rendered', async ({ page }) => {
      await expect(page.locator('.lp-editor-mock')).toBeVisible();
    });

    test('endpoints mock grid is rendered', async ({ page }) => {
      await expect(page.locator('.lp-endpoints-mock')).toBeVisible();
      await expect(page.locator('.lp-endpoint-card')).toHaveCount(6);
    });

    test('hero mock shows faux endpoint rows', async ({ page }) => {
      const rows = page.locator('.lp-mock-row');
      await expect(rows).toHaveCount(4);
      await expect(page.locator('.lp-mock-row-name', { hasText: 'Payment Webhooks' })).toBeVisible();
      await expect(page.locator('.lp-mock-row-name', { hasText: 'Stripe Events' })).toBeVisible();
    });
  });
});
