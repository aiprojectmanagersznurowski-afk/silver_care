import { Page, Locator } from '@playwright/test';

/**
 * Page Object profilu podopiecznego w układzie szablonu (nagłówek, zakładki, pasek boczny).
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: ADM-RESIDENT-CARD-VISIBILITY
 */
export class ResidentProfilePage {
  readonly tablist: Locator;
  readonly sidebar: Locator;
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.tablist = page.locator('main [role="tablist"]:visible').first();
    this.sidebar = page.locator('main [data-slot="profile-sidebar"]:visible');
    this.heading = page.locator('main h1').first();
  }

  /** Otwiera profil pierwszego podopiecznego z listy. */
  async openFirstFromList() {
    await this.page.goto('/admin/residents');
    await this.page.locator('main table tbody tr a').first().click();
    await this.page.waitForURL(/\/admin\/residents\/[a-f0-9-]+/);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Identyfikator pierwszego podopiecznego z tablicy dyżuru (link „Nagraj notatkę” prowadzi do /voice?resident=<id>).
   * Wymaga zalogowanego personelu.
   */
  async firstResidentIdFromStaffBoard(): Promise<string> {
    await this.page.goto('/staff');
    const href = await this.page.locator('a[href^="/voice?resident="]:visible').first().getAttribute('href');
    const id = new URL(href as string, 'http://localhost').searchParams.get('resident');
    if (!id) throw new Error('Brak podopiecznego na tablicy dyżuru');
    return id;
  }

  /** Otwiera kartę podopiecznego w części personelu. */
  async openStaffCard(residentId: string) {
    await this.page.goto(`/staff/residents/${residentId}`);
    await this.page.waitForLoadState('networkidle');
  }

  tab(name: string): Locator {
    return this.tablist.getByRole('tab', { name });
  }

  async tabNames(): Promise<string[]> {
    return this.tablist.getByRole('tab').allInnerTexts();
  }

  visibleCardTitles(): Promise<string[]> {
    return this.page.locator('main [data-slot="card-title"]:visible').allInnerTexts();
  }
}
