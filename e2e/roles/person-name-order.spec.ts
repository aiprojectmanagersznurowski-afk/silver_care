import { test, expect } from '../fixtures/base-test';
import { ResidentsListPage } from '../page-objects/ResidentsListPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Lista podopiecznych pokazuje „Nazwisko Imię” i domyślnie jest ułożona po nazwisku (decyzja Michała 2026-10-26).
 */
test.describe('Podopieczni — Nazwisko Imię i kolejność po nazwisku (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - tabela podopiecznych jest ułożona po nazwisku', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const list = new ResidentsListPage(page);
    await list.goto();

    const names = (await list.residentNames.allInnerTexts()).map((n) => n.trim());
    expect(names.length).toBeGreaterThan(1);
    const collator = new Intl.Collator('pl', { sensitivity: 'base' });
    expect(names).toEqual([...names].sort(collator.compare));
  });
});
