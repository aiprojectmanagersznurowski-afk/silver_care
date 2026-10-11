import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object dla Kreatora Przyjęcia pensjonariusza (AdmissionWizard).
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: SEC-PESEL-HASH
 * @REQ: MDR-VOCABULARY
 */
export class AdmissionWizardPage {
  readonly page: Page;
  readonly openWizardButton: Locator;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly peselInput: Locator;
  readonly peselError: Locator;
  readonly zsnLabel: Locator;
  readonly nextStepButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.openWizardButton = page.locator('button:has-text("Kreator"), button:has-text("Nowe Przyjęcie")');
    this.firstNameInput = page.locator('#wiz-first-name');
    this.lastNameInput = page.locator('#wiz-last-name');
    this.peselInput = page.locator('#wiz-id-val');
    this.peselError = page.locator('#wiz-id-val ~ p, [data-testid="pesel-error"]');
    this.zsnLabel = page.locator('label[for="wiz-zsn"]');
    this.nextStepButton = page.locator('button:has-text("Dalej (Wybór łóżka)")');
  }

  async gotoResidents() {
    await this.page.goto('/admin/residents');
    await this.page.waitForLoadState('networkidle');
  }

  async openWizard() {
    await this.openWizardButton.first().click();
    await expect(this.firstNameInput).toBeVisible();
  }

  async fillStep1(firstName: string, lastName: string, pesel: string) {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.peselInput.fill(pesel);
  }
}
