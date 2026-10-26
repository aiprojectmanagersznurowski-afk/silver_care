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
});
