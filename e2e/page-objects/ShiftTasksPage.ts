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
    const form = page.getByRole('form', { name: 'Nowe zadanie' });
    this.titleInput = form.getByRole('textbox', { name: 'Treść zadania' });
    this.residentSelect = form.getByRole('combobox', { name: 'Podopieczny' });
    this.addButton = form.getByRole('button', { name: 'Dodaj zadanie' });
    this.byRoomLink = page.getByRole('link', { name: 'Według pokoi' });
    this.byResidentLink = page.getByRole('link', { name: 'Według podopiecznych' });
    this.planStatus = page.getByRole('main').getByTestId('plan-approval-status');
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

  get printPreview() {
    return this.page.getByRole('main');
  }

  get returnToApproval() {
    return this.printPreview.getByRole('link', { name: 'Wróć do listy zadań' });
  }

  async gotoPrint(shiftCode: string, date: string, groupBy?: 'room' | 'resident') {
    const params = new URLSearchParams({ shift: shiftCode, date });
    if (groupBy) params.set('groupBy', groupBy);
    await this.page.goto(`/staff/shift-plan/print?${params}`);
  }

  task(title: string): Locator {
    return this.page.locator('[data-testid="task-row"]:visible').filter({ hasText: title });
  }

  async addTask(title: string, residentId?: string, assigneeId?: string) {
    await this.titleInput.fill(title);
    if (residentId) await this.residentSelect.selectOption(residentId);
    if (assigneeId) await this.page.getByRole('form', { name: 'Nowe zadanie' })
      .getByRole('combobox', { name: 'Przypisanie' }).selectOption(assigneeId);
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
    const button = this.task(title).getByRole('button', { name: /^Oznacz jako wykonane/ });
    await expect(button).toBeVisible();
    await button.click();
  }

  get handover() {
    return this.page.getByRole('region', { name: 'Zamknięcie zmiany' });
  }

  async openHandover() {
    await this.page.getByRole('link', { name: 'Zamknięcie zmiany' }).click();
    await expect(this.handover).toBeVisible();
  }

  async openShiftHistory() {
    await this.handover.getByText('Historia zmiany', { exact: true }).click();
    return this.handover.getByRole('table', { name: 'Zdarzenia audytowe' });
  }

  get completeOption() {
    return this.handover.getByRole('option', { name: 'Kompletny' });
  }

  async openHandoverSource(fact: string) {
    const source = this.handover.getByRole('row').filter({ hasText: fact }).getByRole('link', { name: 'Zobacz źródło' });
    await expect(source).toBeVisible();
    await source.click();
    await expect(this.page.getByRole('heading', { name: 'Źródło faktu' })).toBeVisible();
    await expect(this.page.getByText(fact, { exact: true })).toBeVisible();
  }

  async approveHandover(reason: string, amendment = false) {
    await this.handover.getByLabel('Kompletność materiału').selectOption('PARTIAL');
    await this.handover.getByLabel('Powód częściowego zatwierdzenia').fill(reason);
    await this.handover.getByRole('button', { name: amendment ? 'Zatwierdź aneks' : 'Zatwierdź przekazanie' }).click();
  }

  async showMyTasks() {
    await this.page.getByRole('link', { name: 'Moje zadania' }).click();
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
