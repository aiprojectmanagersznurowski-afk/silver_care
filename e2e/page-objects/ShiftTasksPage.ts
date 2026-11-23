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
  readonly printLink: Locator;
  readonly printButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Zadania zmiany', exact: true });
    this.groups = page.locator('[data-testid="task-group"]:visible');
    this.titleInput = page.getByLabel('Treść zadania');
    this.residentSelect = page.getByLabel('Podopieczny');
    this.addButton = page.getByRole('button', { name: 'Dodaj zadanie' });
    this.byRoomLink = page.getByRole('link', { name: 'Według pokoi' });
    this.byResidentLink = page.getByRole('link', { name: 'Według podopiecznych' });
    this.planStatus = page.locator('[data-testid="plan-approval-status"]');
    this.printLink = page.getByRole('link', { name: 'Drukuj plan' });
    this.printButton = page.getByRole('button', { name: 'Drukuj plan' });
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
    return this.page.locator('[data-testid="task-row"]:visible').filter({ hasText: title });
  }

  async addTask(title: string, residentId?: string) {
    await this.titleInput.fill(title);
    if (residentId) await this.residentSelect.selectOption(residentId);
    await this.addButton.click();
  }

  async approveProposal(title: string) {
    await this.task(title).getByRole('button', { name: /^Zatwierdź zadanie/ }).click();
  }

  assigneeSelect(title: string): Locator {
    return this.task(title).getByLabel(`Przypisz zadanie: ${title}`);
  }

  async assign(title: string, userId: string) {
    await this.assigneeSelect(title).selectOption(userId);
    await this.task(title).getByRole('button', { name: 'Zapisz przypisanie' }).click();
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

  voiceEvidence(title: string, quote: string) {
    return this.task(title).getByText(quote, { exact: true })
  }

  confirmVoiceEvidence(title: string) {
    return this.task(title).getByRole('button', { name: 'Potwierdź wykonanie z nagrania' }).click()
  }

  voiceDecision(evidenceId: string) {
    return this.page.request.post('/api/staff/shift-tasks/voice', { data: { evidenceId, decision: 'DONE' } })
  }
}
