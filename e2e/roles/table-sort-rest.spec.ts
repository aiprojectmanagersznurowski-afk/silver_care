import { test, expect } from '../fixtures/base-test';
import { StaffBoardPage } from '../page-objects/StaffBoardPage';
import { InvitationsPage } from '../page-objects/InvitationsPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Sortowanie kolumn także na tablicy dyżuru i w zaproszeniach (decyzja Michała 2026-10-26).
 */
const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });

test.describe('Sortowanie kolumn — tablica dyżuru i zaproszenia (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - tablica dyżuru: podopieczny domyślnie rosnąco, kliknięcie odwraca', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    const board = new StaffBoardPage(page);
    await board.goto();

    const header = board.columnHeader('Podopieczny');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    const names = await board.tableResidentNames();
    expect(names.length).toBeGreaterThan(1);
    expect(names).toEqual([...names].sort(collator.compare).reverse());
  });

  test('@REQ: ADM-INVITE - zaproszenia: sortowanie po adresie e-mail', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const invitations = new InvitationsPage(page);
    await invitations.goto();

    const header = invitations.columnHeader('Email zapraszanego');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    const emails = await invitations.emails();
    expect(emails.length).toBeGreaterThan(1);
    expect(emails).toEqual([...emails].sort(collator.compare));
  });
});
