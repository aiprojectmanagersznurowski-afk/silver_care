import { test, expect } from '../fixtures/base-test';
import { ResidentsListPage } from '../page-objects/ResidentsListPage';
import { FacilityPage } from '../page-objects/FacilityPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Kolumny tabel sortuje się kliknięciem w nagłówek; nagłówek ogłasza kierunek przez aria-sort
 * (decyzja Michała 2026-10-26).
 */
const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });

test.describe('Sortowanie kolumn tabel (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - podopieczni: nazwisko rosnąco domyślnie, kliknięcie odwraca', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    const header = list.columnHeader('Nazwisko i imię');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');

    const names = (await list.residentNames.allInnerTexts()).map((n) => n.trim());
    expect(names.length).toBeGreaterThan(1);
    expect(names).toEqual([...names].sort(collator.compare).reverse());
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - pokoje: numer sortowany jak liczba', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();
    await facility.viewTableButton.click();

    const header = facility.columnHeader('Pokój');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    const numbers = (await facility.roomNumbers.allInnerTexts()).map((n) => n.replace('Pokój', '').trim());
    expect(numbers.length).toBeGreaterThan(1);
    expect(numbers).toEqual([...numbers].sort(collator.compare));

    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
  });
});
