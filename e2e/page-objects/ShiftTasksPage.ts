import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object listy zadań zmiany (/staff/shift-tasks).
 * @REQ: NUR-TASKS
 */
export class ShiftTasksPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly groups: Locator;
  readonly titleInput: Locator;
  readonly residentSelect: Locator;
  readonly addButton: Locator;
  readonly byRoomLink: Locator;
  readonly byResidentLink: Locator;
  readonly planStatus: Locator;
  readonly approvePlanButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator(':is(h1, h2):has-text("Zadania zmiany")');
    this.groups = page.locator('[data-testid="task-group"]');
    this.titleInput = page.getByLabel('Treść zadania');
    this.residentSelect = page.getByLabel('Podopieczny');
    this.addButton = page.getByRole('button', { name: 'Dodaj zadanie' });
    this.byRoomLink = page.getByRole('link', { name: 'Według pokoi' });
    this.byResidentLink = page.getByRole('link', { name: 'Według podopiecznych' });
    this.planStatus = page.locator('[data-testid="plan-approval-status"]');
    this.approvePlanButton = page.getByRole('button', { name: 'Zatwierdź plan' });
  }

  async goto(shiftCode: string, date: string, group?: 'room' | 'resident') {
    await this.page.goto(`/staff/shift-tasks?shift=${shiftCode}&date=${date}${group ? `&group=${group}` : ''}`);
    await expect(this.heading).toBeVisible();
  }

  group(label: string | RegExp): Locator {
    return this.groups.filter({ hasText: label });
  }

  task(title: string): Locator {
    return this.page.locator('[data-testid="task-row"]').filter({ hasText: title });
  }

  async addTask(title: string, residentId?: string) {
    await this.titleInput.fill(title);
    if (residentId) await this.residentSelect.selectOption(residentId);
    await this.addButton.click();
  }

  async approveProposal(title: string) {
    await this.task(title).getByRole('button', { name: /^Zatwierdź zadanie/ }).click();
  }

  async markDone(title: string) {
    await this.task(title).getByRole('button', { name: /^Wykonane:/ }).click();
  }

  async cancel(title: string, reason: string) {
    const row = this.task(title);
    await row.getByRole('button', { name: /^Anuluj zadanie/ }).click();
    if (reason) await row.getByLabel('Powód anulowania').fill(reason);
    await row.getByRole('button', { name: 'Potwierdź anulowanie' }).click();
  }

  async carry(title: string, targetShiftName: string, targetDate: string) {
    const row = this.task(title);
    await row.getByRole('button', { name: /^Przenieś zadanie/ }).click();
    await row.getByLabel('Zmiana docelowa').selectOption({ label: targetShiftName });
    await row.getByLabel('Data docelowa').fill(targetDate);
    await row.getByRole('button', { name: 'Potwierdź przeniesienie' }).click();
  }
}
