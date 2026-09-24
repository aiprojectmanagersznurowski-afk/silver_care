import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Portalu Administratora i Super Administratora (/admin).
 */
export class AdminDashboardPage {
  readonly page: Page;
  readonly mainHeading: Locator;
  readonly subHeading: Locator;
  readonly logoutButton: Locator;

  // Linki nawigacyjne w sidebarze
  readonly organizationsLink: Locator;
  readonly iamLink: Locator;
  readonly auditLink: Locator;
  readonly facilityLink: Locator;
  readonly residentsLink: Locator;
  readonly staffLink: Locator;
  readonly invitationsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainHeading = page.locator('h2:has-text("Pulpit Główny"), h2:has-text("Pulpit Placówki"), h2:has-text("Placówki")').first();
    this.subHeading = page.locator('text=Szybki podgląd stanu placówki, text=Zarządzanie placówkami partnerskimi').first();
    this.logoutButton = page.locator('form[action="/auth/signout"] button[type="submit"]');

    this.organizationsLink = page.locator('aside a[href="/admin/organizations"]');
    this.iamLink = page.locator('aside a[href="/admin/iam"]');
    this.auditLink = page.locator('aside a[href="/admin/audit"]');
    this.facilityLink = page.locator('aside a[href="/admin/facility"]');
    this.residentsLink = page.locator('aside a[href="/admin/residents"]');
    this.staffLink = page.locator('aside a[href="/admin/staff"]');
    this.invitationsLink = page.locator('aside a[href="/admin/invitations"]');
  }

  async goto() {
    await this.page.goto('/admin');
  }

  async expectDashboardLoaded() {
    await expect(this.mainHeading).toBeVisible();
  }

  async navigateToOrganizations() {
    await this.organizationsLink.click();
    await this.page.waitForURL('**/admin/organizations');
  }

  async navigateToIam() {
    await this.iamLink.click();
    await this.page.waitForURL('**/admin/iam');
  }

  async navigateToAudit() {
    await this.auditLink.click();
    await this.page.waitForURL('**/admin/audit');
  }

  async navigateToFacility() {
    await this.facilityLink.click();
    await this.page.waitForURL('**/admin/facility');
  }

  async navigateToResidents() {
    await this.residentsLink.click();
    await this.page.waitForURL('**/admin/residents');
  }

  async navigateToStaff() {
    await this.staffLink.click();
    await this.page.waitForURL('**/admin/staff');
  }

  async logout() {
    await this.logoutButton.first().click();
    await this.page.waitForURL('**/login');
  }
}
