import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Endpoint Detail Page (/dashboard/endpoint/:id).
 */
export class EndpointDetailPage {
  readonly page: Page;

  // Header
  readonly header: Locator;
  readonly headerLogo: Locator;

  // Action bar
  readonly backButton: Locator;
  readonly webhookUrlDisplay: Locator;
  readonly editButton: Locator;
  readonly copyButton: Locator;
  readonly autoRefreshToggle: Locator;
  readonly optionsButton: Locator;

  // Sidebar (request list)
  readonly sidebar: Locator;
  readonly requestListItems: Locator;
  readonly noRequestsText: Locator;
  readonly deleteAllButton: Locator;
  readonly mobileMenuButton: Locator;

  // Tab navigation
  readonly headerTab: Locator;
  readonly bodyTab: Locator;
  readonly queryTab: Locator;
  readonly responseTab: Locator;

  // Content area
  readonly contentArea: Locator;
  readonly addNoteButton: Locator;
  readonly noBodyText: Locator;
  readonly noQueryText: Locator;
  readonly selectRequestText: Locator;

  // Clear all dialog
  readonly clearDialog: Locator;
  readonly clearDialogTitle: Locator;
  readonly clearDialogCancel: Locator;
  readonly clearDialogConfirm: Locator;

  // Loading state
  readonly loadingSpinner: Locator;

  // Not found state
  readonly notFoundText: Locator;
  readonly backToDashboardButton: Locator;

  // Footer
  readonly footer: Locator;
  readonly copyrightText: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.header = page.getByRole('banner');
    this.headerLogo = page.getByRole('banner').getByText('Hooklab');

    // Action bar
    this.backButton = page.getByTestId('back-button');
    this.webhookUrlDisplay = page.locator('.action-bar__toolbar-url');
    this.editButton = page.getByTestId('edit-button');
    this.copyButton = page.getByRole('button', { name: /Copy/i }).first();
    this.autoRefreshToggle = page.locator('.action-bar__live');
    this.optionsButton = page.getByRole('button', { name: 'OPTIONS' });

    // Sidebar
    this.sidebar = page.locator('aside');
    this.requestListItems = page.locator('.request-list-item');
    this.noRequestsText = page.getByText('Waiting for first webhook...');
    this.deleteAllButton = page.getByTestId('clear-all-button');
    this.mobileMenuButton = page.locator('.action-bar__mobile-toggle');

    // Tabs
    this.headerTab = page.getByRole('button', { name: /^Header$/i });
    this.bodyTab = page.getByRole('button', { name: /^Body$/i });
    this.queryTab = page.getByRole('button', { name: /^Query$/i });
    this.responseTab = page.getByRole('button', { name: /^Response$/i });

    // Content area
    this.contentArea = page.locator('.detail-tabs');
    this.addNoteButton = page.getByText('Add Note');
    this.noBodyText = page.getByText('No body.');
    this.noQueryText = page.getByText('No query parameters.');
    this.selectRequestText = page.getByText('Select a request from the sidebar');

    // Clear all dialog
    this.clearDialog = page.getByRole('dialog');
    this.clearDialogTitle = page.getByRole('dialog').getByText('Delete All Requests');
    this.clearDialogCancel = page.getByRole('dialog').getByRole('button', { name: 'Cancel' });
    this.clearDialogConfirm = page.getByRole('dialog').getByRole('button', {
      name: /Delete All/i,
    });

    // Loading state
    this.loadingSpinner = page.locator('.endpoint-detail__loading-icon');

    // Not found state
    this.notFoundText = page.getByText('Endpoint not found');
    this.backToDashboardButton = page.getByRole('button', {
      name: 'Back to Dashboard',
    });

    // Footer
    this.footer = page.locator('footer');
    this.copyrightText = page.getByText('Usual copyright notice');
  }

  async goto(endpointId: string) {
    await this.page.goto(`/dashboard/endpoint/${endpointId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.headerLogo).toBeVisible();
    await expect(this.backButton).toBeVisible();
  }

  async expectNotFound() {
    await expect(this.notFoundText).toBeVisible();
  }

  async clickBack() {
    await this.backButton.click();
  }

  async clickCopy() {
    await this.copyButton.click();
  }

  async toggleAutoRefresh() {
    await this.autoRefreshToggle.click();
  }

  // Tab navigation
  async clickHeaderTab() {
    await this.headerTab.click();
  }

  async clickBodyTab() {
    await this.bodyTab.click();
  }

  async clickQueryTab() {
    await this.queryTab.click();
  }

  async clickResponseTab() {
    await this.responseTab.click();
  }

  // Request list
  async selectRequest(index: number) {
    const items = this.page.locator('.request-list-item').filter({
      has: this.page.locator('span', { hasText: `Request ${index + 1}` }),
    });
    await items.first().click();
  }

  async getRequestCount(): Promise<number> {
    return await this.requestListItems.count();
  }

  // Delete all
  async clickDeleteAll() {
    await this.deleteAllButton.click();
  }

  async confirmDeleteAll() {
    await this.clearDialogConfirm.click();
  }

  async cancelDeleteAll() {
    await this.clearDialogCancel.click();
  }

  // Content verification
  async expectHeaderTabContent() {
    await expect(this.addNoteButton).toBeVisible();
  }

  async expectBodyContent(text: string) {
    await expect(this.page.getByText(text, { exact: false })).toBeVisible();
  }

  async expectQueryParam(key: string, value: string) {
    await expect(this.page.getByText(key)).toBeVisible();
    await expect(this.page.getByText(value)).toBeVisible();
  }

  async expectResponseStatus(status: string) {
    await expect(this.page.getByText('Status')).toBeVisible();
    await expect(this.page.getByText(status)).toBeVisible();
  }

  async expectWebhookUrl(url: string) {
    await expect(this.page.locator('.action-bar__toolbar-url', { hasText: url })).toBeVisible();
  }

  async expectSuccessToast(text: string) {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 });
  }
}
