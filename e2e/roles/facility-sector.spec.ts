import { test, expect } from '../fixtures/base-test';
import { FacilityPage } from '../page-objects/FacilityPage';

/**
 * @REQ: ADM-FACILITY-MANAGE
 *
 * Sektor jest pokazywany tak, jak go nazwano — bez dopisanego przedrostka „Sektor” (decyzja Michała 2026-10-26).
 */
test.describe('Struktura placówki — nazwy sektorów (@REQ: ADM-FACILITY-MANAGE)', () => {
  test('@REQ: ADM-FACILITY-MANAGE - filtr i tabela pokoi pokazują sektor bez przedrostka', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();

    const options = await facility.sectorOptionLabels();
    expect(options.length, 'placówka testowa powinna mieć pokoje z sektorem').toBeGreaterThan(0);
    for (const label of options) expect(label).not.toMatch(/^sektor\b/i);

    await facility.viewTableButton.click();
    const cells = await facility.sectorCells.allInnerTexts();
    expect(cells.length).toBeGreaterThan(0);
    for (const text of cells) expect(text.trim()).not.toMatch(/^sektor\b/i);
  });

  // Karta Trello PLC-9D9B: „Sektor B” i „B” w bazie dawały dwie pozycje „B” w filtrze.
  test('@REQ: ADM-FACILITY-MANAGE - ten sam sektor zapisany z przedrostkiem i bez jest jedną pozycją filtra', async ({ loginPage, page }) => {
    await page.route('**/api/facility/rooms', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      const data = await response.json();
      expect(data.rooms.length, 'placówka testowa powinna mieć co najmniej dwa pokoje').toBeGreaterThanOrEqual(2);
      data.rooms[0].sector = 'Sektor Zduplikowany';
      data.rooms[1].sector = 'Zduplikowany';
      await route.fulfill({ response, json: data });
    });

    await loginPage.loginAs('org_admin');
    const facility = new FacilityPage(page);
    await facility.goto();

    const options = await facility.sectorOptionLabels();
    expect(options.filter((l) => l === 'Zduplikowany')).toHaveLength(1);

    await facility.switchToTable();
    await facility.sectorFilter.selectOption({ label: 'Zduplikowany' });
    await expect(facility.sectorCells).toHaveCount(2);
  });
});
