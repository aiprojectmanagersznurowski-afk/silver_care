import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla weryfikacji raportów personelu (/staff/reports)
 * @REQ: REPORT-AI-FEEDBACK
 * @REQ: REPORT-APPROVAL
 * @REQ: MDR-VOCABULARY
 */
export class StaffReportsPage {
  readonly page: Page;
  readonly headerTitle: Locator;
  readonly emptyStateHeading: Locator;
  readonly reportCards: Locator;
  readonly completenessGate: Locator;
  readonly completenessScore: Locator;
  readonly completenessSuggestion: Locator;
  readonly editReportButton: Locator;
  readonly publishReportButton: Locator;
  readonly contentTextarea: Locator;
  readonly saveReportButton: Locator;
  readonly reportContentText: Locator;
  readonly publishedStatusBadge: Locator;
  readonly draftStatusBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.headerTitle = page.locator('h2:has-text("Raporty")').first();
    this.emptyStateHeading = page.locator('h3:has-text("Brak raportów")');
    this.reportCards = page.locator('[data-testid="report-card"]');
    this.completenessGate = page.locator('[data-testid="completeness-gate"]');
    this.completenessScore = page.locator('[data-testid="completeness-score"]');
    this.completenessSuggestion = page.locator('[data-testid="completeness-suggestion"]');
    this.editReportButton = page.locator('[data-testid="edit-report-button"]');
    this.publishReportButton = page.locator('[data-testid="publish-report-button"]');
    this.contentTextarea = page.locator('[data-testid="report-content-textarea"]');
    this.saveReportButton = page.locator('[data-testid="save-report-button"]');
    this.reportContentText = page.locator('[data-testid="report-content-text"]');
    this.publishedStatusBadge = page.locator('[data-testid="report-status-published"]');
    this.draftStatusBadge = page.locator('[data-testid="report-status-draft"]');
  }

  async goto(residentId?: string) {
    const url = residentId ? `/staff/reports?resident=${residentId}` : '/staff/reports';
    await this.page.goto(url);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectPageLoaded() {
    await expect(this.headerTitle).toBeVisible();
  }

  async getDimensionPill(dimensionId: 'meals' | 'mood' | 'activity' | 'rest'): Promise<Locator> {
    return this.page.locator(`[data-testid="completeness-dimension-${dimensionId}"]`);
  }
}
