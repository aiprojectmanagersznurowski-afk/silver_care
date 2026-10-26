import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla modułu Statusu Systemu i Alertów Globalnych (/admin/system-status)
 * oraz globalnego bannera ostrzegawczego (SystemAlertBanner) w panelach placówki.
 */
export class SystemStatusPage {
  readonly page: Page;
  readonly sidebarLink: Locator;
  readonly heading: Locator;
  readonly currentStatusBadge: Locator;
  readonly titleInput: Locator;
  readonly messageInput: Locator;
  readonly severitySelect: Locator;
  readonly statusSelect: Locator;
  readonly publishButton: Locator;
  readonly globalAlertBanner: Locator;
  readonly resolveAlertButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebarLink = page.locator('[data-slot="sidebar"] a[href="/admin/system-status"]');
    this.heading = page.locator('h2:has-text("Status Systemu i Alerty")');
    this.currentStatusBadge = page.locator('[data-testid="system-overall-status"]');
    this.titleInput = page.locator('[data-testid="system-alert-title-input"]');
    this.messageInput = page.locator('[data-testid="system-alert-message-input"]');
    this.severitySelect = page.locator('[data-testid="system-alert-severity-select"]');
    this.statusSelect = page.locator('[data-testid="system-alert-status-select"]');
    this.publishButton = page.locator('[data-testid="system-alert-publish-btn"]');
    this.globalAlertBanner = page.locator('[data-testid="global-system-alert-banner"]');
    this.resolveAlertButton = page.locator('[data-testid="resolve-system-alert-btn"]').first();
  }

  async goto() {
    await this.page.goto('/admin/system-status');
  }

  async navigateFromSidebar() {
    const trigger = this.page.locator('[data-slot="sidebar-trigger"]');
    if (!(await this.sidebarLink.isVisible()) && (await trigger.isVisible())) {
      await trigger.click();
    }
    await this.sidebarLink.click();
    await this.page.waitForURL('**/admin/system-status');
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.currentStatusBadge).toBeVisible();
  }

  /** Pole wyboru modułu w kafelku — do sprawdzania zaznaczenia (bez publikowania alertu). */
  serviceCheckbox(serviceId: string): Locator {
    return this.page.locator(`[data-testid="service-checkbox-${serviceId}"] input[type="checkbox"]`);
  }

  async toggleServiceCheckbox(serviceId: string) {
    const checkbox = this.page.locator(`[data-testid="service-checkbox-${serviceId}"]`);
    await checkbox.click();
  }

  async publishAlert(params: {
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'error';
    status?: 'degraded' | 'maintenance';
    services?: string[];
  }) {
    await this.titleInput.fill(params.title);
    await this.messageInput.fill(params.message);
    if (params.severity) {
      await this.severitySelect.selectOption(params.severity);
    }
    if (params.status) {
      await this.statusSelect.selectOption(params.status);
    }
    if (params.services) {
      for (const s of params.services) {
        await this.toggleServiceCheckbox(s);
      }
    }
    await this.publishButton.click();
  }

  async resolveFirstActiveAlert() {
    await this.resolveAlertButton.click();
  }

  async resolveAlertByTitle(title: string) {
    const item = this.page.locator(`[data-testid="system-alert-item"][data-alert-title="${title}"]`);
    await item.locator('[data-testid="resolve-system-alert-btn"]').click();
  }
}
