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

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator(':is(h1, h2):has-text("Zadania zmiany")');
    this.groups = page.locator('[data-testid="task-group"]');
    this.titleInput = page.getByLabel('Treść zadania');
    this.residentSelect = page.getByLabel('Podopieczny');
    this.addButton = page.getByRole('button', { name: 'Dodaj zadanie' });
    this.byRoomLink = page.getByRole('link', { name: 'Według pokoi' });
    this.byResidentLink = page.getByRole('link', { name: 'Według podopiecznych' });
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
}
