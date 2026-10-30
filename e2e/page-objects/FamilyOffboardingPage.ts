import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla widoku pożegnalnego / retencji portalu rodziny (/dashboard).
 */
export class FamilyOffboardingPage {
  readonly page: Page;
  readonly downloadArchiveBtn: Locator;
  readonly expiryNotice: Locator;
  readonly expiredTitle: Locator;
  readonly expiredDescription: Locator;
  readonly logoutButton: Locator;
  readonly reportsHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.downloadArchiveBtn = page.locator('[data-testid="download-memorial-archive-btn"]');
    this.expiryNotice = page.locator('text=Dostęp do portalu wygasa:');
    this.expiredTitle = page.locator('h1:has-text("Okres retencji dostępu wygasł")');
    this.expiredDescription = page.locator('text=30-dniowe okno dostępu do historii pobytu podopiecznego');
    this.logoutButton = page.locator('button:has-text("Wyloguj się")');
    this.reportsHeading = page.locator('h2:has-text("Archiwum opublikowanych raportów")');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async selectResidentCookie(residentId: string) {
    await this.page.context().addCookies([
      {
        name: 'family_resident_id',
        value: residentId,
        url: 'http://localhost:3001',
      },
    ]);
  }

  async expectMemorialWindowVisible(params: { isDeceased: boolean }) {
    await expect(this.downloadArchiveBtn).toBeVisible({ timeout: 10000 });
    await expect(this.expiryNotice).toBeVisible();
    const expectedBtnText = params.isDeceased
      ? 'Pobierz pamiątkowe archiwum pobytu'
      : 'Pobierz archiwum raportów z pobytu';
    await expect(this.downloadArchiveBtn).toContainText(expectedBtnText);
  }

  async expectRetentionExpiredVisible() {
    await expect(this.expiredTitle).toBeVisible({ timeout: 10000 });
    await expect(this.expiredDescription).toBeVisible();
    await expect(this.logoutButton).toBeVisible();
  }

  async downloadArchive(): Promise<{ fileName: string; content: string }> {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadArchiveBtn.click();
    const download = await downloadPromise;
    const fileName = download.suggestedFilename();
    const stream = await download.createReadStream();
    if (!stream) throw new Error('Nie udało się utworzyć strumienia pobierania');

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    return { fileName, content };
  }
}
