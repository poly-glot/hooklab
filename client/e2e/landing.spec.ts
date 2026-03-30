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

    test('scripting and endpoints sections have CTA buttons', async ({ landingPage }) => {
      await expect(landingPage.scriptingSection).toBeVisible();
      await expect(landingPage.tryScriptEditorButton).toBeVisible();
      await expect(landingPage.endpointsSection).toBeVisible();
      await expect(landingPage.createFirstEndpointButton).toBeVisible();
    });

    test('how it works section shows three steps', async ({ landingPage }) => {
      await expect(landingPage.steps).toHaveCount(3);
    });

    test('CTA section and footer are visible', async ({ landingPage }) => {
      await expect(landingPage.ctaSection).toBeVisible();
      await expect(landingPage.ctaButton).toBeVisible();
      await expect(landingPage.footer).toBeVisible();
      await expect(landingPage.footerLogo).toHaveText('HOOKLAB');
    });
  });

  test.describe('Navigation', () => {
    test('CTA buttons navigate to auth page', async ({ landingPage, page }) => {
      await landingPage.clickGetStarted();
      await expect(page).toHaveURL(/\/auth/);

      await landingPage.goto();
      await landingPage.clickStartTesting();
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

});
