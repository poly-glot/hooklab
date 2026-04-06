import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Dashboard Page (/dashboard).
 */
export class DashboardPage {
  readonly page: Page;

  // Header
  readonly header: Locator;
  readonly headerLogo: Locator;
  readonly githubLink: Locator;

  // Action bar
  readonly actionBar: Locator;
  readonly readyText: Locator;
  readonly searchInput: Locator;
  readonly addNewButton: Locator;

  // Filter pills
  readonly allFilter: Locator;
  readonly activeFilter: Locator;
  readonly closedFilter: Locator;

  // Endpoint list
  readonly endpointList: Locator;
  readonly endpointCards: Locator;
  readonly emptyStateText: Locator;
  readonly emptyStateAddButton: Locator;
  readonly loadingText: Locator;

  // Create dialog
  readonly createDialog: Locator;
  readonly createDialogTitle: Locator;
  readonly endpointNameInput: Locator;
  readonly createDialogCancel: Locator;
  readonly createDialogSubmit: Locator;

  // Delete dialog
  readonly deleteDialog: Locator;
  readonly deleteDialogTitle: Locator;
  readonly deleteDialogCancel: Locator;
  readonly deleteDialogConfirm: Locator;

  // Footer
  readonly footer: Locator;
  readonly copyrightText: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.header = page.getByRole('banner');
    this.headerLogo = page.getByRole('banner').getByText('Hooklab');
    this.githubLink = page.getByRole('banner').getByText('Github');

    // Action bar
    this.actionBar = page.locator('.action-bar').first();
    this.readyText = page.getByText('Application is ready to use');
    this.searchInput = page.getByPlaceholder('search by webhook');
    this.addNewButton = page.getByRole('button', { name: 'ADD NEW' }).first();

    // Filter pills
    this.allFilter = page.getByRole('button', { name: /^All/ });
    this.activeFilter = page.getByRole('button', { name: /^Active/ });
    this.closedFilter = page.getByRole('button', { name: /^Closed/ });

    // Endpoint list area
    this.endpointList = page.locator('main');
    this.endpointCards = page.locator('[data-testid="endpoint-card"]');
    this.emptyStateText = page.getByText(/No endpoints/);
    this.emptyStateAddButton = page.locator('main').getByRole('button', { name: 'ADD NEW' });
    this.loadingText = page.getByText('Loading endpoints...');

    // Create dialog
    this.createDialog = page.getByRole('dialog');
    this.createDialogTitle = page.getByRole('dialog').getByText('Create New Endpoint');
    this.endpointNameInput = page.getByLabel('Endpoint Name');
    this.createDialogCancel = page.getByRole('dialog').getByRole('button', { name: 'Cancel' });
    this.createDialogSubmit = page.getByRole('dialog').getByRole('button', {
      name: /Create Endpoint/i,
    });

    // Delete dialog
    this.deleteDialog = page.getByRole('dialog');
    this.deleteDialogTitle = page.getByRole('dialog').getByText('Delete Endpoint');
    this.deleteDialogCancel = page.getByRole('dialog').getByRole('button', { name: 'Cancel' });
    this.deleteDialogConfirm = page.getByRole('dialog').getByRole('button', { name: /^Delete$/i });

    // Footer
    this.footer = page.locator('footer');
    this.copyrightText = page.getByText('Usual copyright notice');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectLoaded() {
    await expect(this.headerLogo).toBeVisible();
  }

  async expectLoadingState() {
    await expect(this.loadingText).toBeVisible();
  }

  async expectEmptyState() {
    await expect(this.emptyStateText).toBeVisible();
  }

  async expectEndpointsVisible(names: string[]) {
    for (const name of names) {
      await expect(this.page.getByText(name, { exact: false })).toBeVisible();
    }
  }

  async clickAddNew() {
    await this.addNewButton.click();
  }

  async fillEndpointName(name: string) {
    await this.endpointNameInput.fill(name);
  }

  async submitCreateEndpoint() {
    await this.createDialogSubmit.click();
  }

  async createEndpoint(name: string) {
    await this.clickAddNew();
    await expect(this.createDialogTitle).toBeVisible();
    await this.fillEndpointName(name);
    await this.submitCreateEndpoint();
  }

  async cancelCreateEndpoint() {
    await this.createDialogCancel.click();
  }

  async searchEndpoints(query: string) {
    await this.searchInput.fill(query);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async filterByAll() {
    await this.allFilter.click();
  }

  async filterByActive() {
    await this.activeFilter.click();
  }

  async filterByClosed() {
    await this.closedFilter.click();
  }

  async clickEndpointCard(name: string) {
    await this.page
      .locator('[data-testid="endpoint-card"]', { hasText: name })
      .first()
      .click();
  }

  async openEndpointOptions(name: string) {
    const card = this.page.locator('[data-testid="endpoint-card"]', { hasText: name }).first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.locator('[aria-label="Options"]').click();
  }

  async clickDeleteInDropdown() {
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
  }

  async clickDisableInDropdown() {
    await this.page.getByRole('menuitem', { name: 'Disable' }).click();
  }

  async clickEnableInDropdown() {
    await this.page.getByRole('menuitem', { name: 'Enable' }).click();
  }

  async confirmDelete() {
    await this.deleteDialogConfirm.click();
  }

  async cancelDelete() {
    await this.deleteDialogCancel.click();
  }

  async getEndpointCardCount(): Promise<number> {
    return await this.page.locator('[data-testid="endpoint-card"]').count();
  }

  async expectSuccessToast(text: string) {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 });
  }

  async expectErrorToast(text: string) {
    await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 });
  }
}
