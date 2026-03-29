import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Landing Page (/).
 */
export class LandingPage {
  readonly page: Page;

  // Navigation
  readonly nav: Locator;
  readonly navLogo: Locator;
  readonly featuresLink: Locator;
  readonly scriptingLink: Locator;
  readonly endpointsLink: Locator;
  readonly getStartedNavButton: Locator;

  // Hero section
  readonly heroSection: Locator;
  readonly heroLabel: Locator;
  readonly heroTitle: Locator;
  readonly heroSubtitle: Locator;
  readonly startTestingButton: Locator;
  readonly seeHowItWorksLink: Locator;

  // Features section
  readonly featuresSection: Locator;
  readonly featureCards: Locator;

  // Scripting section
  readonly scriptingSection: Locator;
  readonly tryScriptEditorButton: Locator;

  // Endpoints section
  readonly endpointsSection: Locator;
  readonly createFirstEndpointButton: Locator;

  // How it works section
  readonly stepsSection: Locator;
  readonly steps: Locator;

  // CTA section
  readonly ctaSection: Locator;
  readonly ctaButton: Locator;

  // Footer
  readonly footer: Locator;
  readonly footerLogo: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.nav = page.locator('.lp-nav');
    this.navLogo = page.locator('.lp-nav-logo');
    this.featuresLink = page.locator('.lp-nav-link', { hasText: 'Features' });
    this.scriptingLink = page.locator('.lp-nav-link', { hasText: 'Scripting' });
    this.endpointsLink = page.locator('.lp-nav-link', { hasText: 'Endpoints' });
    this.getStartedNavButton = page.locator('.lp-nav-cta');

    // Hero
    this.heroSection = page.locator('.lp-hero');
    this.heroLabel = page.locator('.lp-hero-label');
    this.heroTitle = page.locator('.lp-hero-title');
    this.heroSubtitle = page.locator('.lp-hero-subtitle');
    this.startTestingButton = page.locator('.lp-btn-primary', { hasText: 'Start Testing' });
    this.seeHowItWorksLink = page.locator('.lp-btn-outline', { hasText: 'See How It Works' });

    // Features
    this.featuresSection = page.locator('#features');
    this.featureCards = page.locator('.lp-feature-card');

    // Scripting
    this.scriptingSection = page.locator('#scripting');
    this.tryScriptEditorButton = page.locator('.lp-btn-primary', {
      hasText: 'Try the Script Editor',
    });

    // Endpoints
    this.endpointsSection = page.locator('#endpoints');
    this.createFirstEndpointButton = page.locator('.lp-btn-primary', {
      hasText: 'Create Your First Endpoint',
    });

    // How it works
    this.stepsSection = page.locator('.lp-steps');
    this.steps = page.locator('.lp-step');

    // CTA
    this.ctaSection = page.locator('.lp-cta-section');
    this.ctaButton = page.locator('.lp-btn-cta');

    // Footer
    this.footer = page.locator('.lp-footer');
    this.footerLogo = page.locator('.lp-footer-logo');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.navLogo).toBeVisible();
    await expect(this.heroTitle).toBeVisible();
  }

  async clickGetStarted() {
    await this.getStartedNavButton.click();
  }

  async clickStartTesting() {
    await this.startTestingButton.click();
  }

  async clickTryScriptEditor() {
    await this.tryScriptEditorButton.click();
  }

  async clickCreateFirstEndpoint() {
    await this.createFirstEndpointButton.click();
  }

  async clickCtaButton() {
    await this.ctaButton.click();
  }

  async scrollToFeatures() {
    await this.featuresLink.click();
  }

  async scrollToScripting() {
    await this.scriptingLink.click();
  }

  async scrollToEndpoints() {
    await this.endpointsLink.click();
  }
}
