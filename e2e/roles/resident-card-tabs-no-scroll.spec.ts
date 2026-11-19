import { test, expect } from '../fixtures/base-test';
import { ResidentProfilePage } from '../page-objects/ResidentProfilePage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Pasek zakładek karty podopiecznego (Przegląd, Aktywność i sen, …) nie ma paska przewijania —
 * zakładki mieszczą się albo zawijają (zgłoszenie Michała 2026-11-17, rola pielęgniarki).
 */
for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
  test(`@REQ: UI-TEMPLATE-ALIGNMENT - karta pielęgniarki ${viewport.width}px: zakładki bez przewijania`, async ({ loginPage, page }) => {
    await page.setViewportSize(viewport);
    await loginPage.loginAs('nurse');
    const card = new ResidentProfilePage(page);
    await card.openStaffCard(await card.firstResidentIdFromStaffBoard());

    const scrollable = await card.tablist.evaluate((list) => {
      const offenders: string[] = [];
      for (let el: HTMLElement | null = list; el && el.tagName !== 'MAIN'; el = el.parentElement) {
        const cs = getComputedStyle(el);
        const scrollsX = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
        const scrollsY = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
        if (scrollsX || scrollsY) offenders.push(`${el.tagName}.${el.className.slice(0, 40)}`);
      }
      return offenders;
    });
    expect(scrollable, 'żaden kontener zakładek nie przewija się').toEqual([]);

    for (const name of await card.tabNames()) {
      await expect(card.tablist.getByRole('tab', { name })).toBeInViewport();
    }
  });
}
