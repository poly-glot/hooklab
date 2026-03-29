import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Auth Page (/auth).
 */
export class AuthPage {
  readonly page: Page;

  // Modal card
  readonly modalCard: Locator;
  readonly title: Locator;
  readonly description: Locator;

  // Auth buttons
  readonly googleButton: Locator;
  readonly emailLinkButton: Locator;
  readonly guestButton: Locator;

  // Blurred background elements (faux dashboard)
  readonly blurredBackground: Locator;

  // Toast messages
  readonly toastContainer: Locator;

  constructor(page: Page) {
    this.page = page;

    // Modal card container
    this.modalCard = page.locator('.auth-page__modal').first();
    this.title = page.getByRole('heading', { name: 'HOOKLAB' });
    this.description = page.locator('.auth-page__modal p').first();

    // Auth buttons
    this.googleButton = page.getByRole('button', { name: /Continue with Google/i });
    this.emailLinkButton = page.getByRole('button', { name: /Continue with Email Link/i });
    this.guestButton = page.getByRole('button', { name: /Continue as/i });

    // Background
    this.blurredBackground = page.locator('.auth-page__bg-blur');

    // Toast
    this.toastContainer = page.locator('[data-sonner-toaster]');
  }

  async goto() {
    await this.page.goto('/auth');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.modalCard).toBeVisible();
    await expect(this.title).toBeVisible();
  }

  async clickGoogle() {
    await this.googleButton.click();
  }

  async clickEmailLink() {
    await this.emailLinkButton.click();
  }

  async clickGuest() {
    await this.guestButton.click();
  }

  async expectComingSoonToast() {
    await expect(this.page.getByText('Coming soon')).toBeVisible({ timeout: 5000 });
  }

  async expectErrorToast(message?: string) {
    if (message) {
      await expect(this.page.getByText(message)).toBeVisible({ timeout: 5000 });
    } else {
      await expect(this.page.locator('[data-type="error"]')).toBeVisible({ timeout: 5000 });
    }
  }

  async expectRedirectToDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  }
}
