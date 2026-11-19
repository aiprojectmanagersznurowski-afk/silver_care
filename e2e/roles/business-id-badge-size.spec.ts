import { test, expect } from '../fixtures/base-test';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Plakietka z identyfikatorem (BusinessIdBadge) ma rozmiar plakietki statusu (np. „Zakończony pobyt”:
 * text-xs, py-0.5) i stałą, niezbyt dużą szerokość mieszczącą ID i przycisk kopiowania
 * (decyzja Michała 2026-11-17, cały system).
 */
test.describe('Plakietka identyfikatora — rozmiar jak plakietka statusu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - lista placówek: jedna szerokość, wysokość plakietki statusu', async ({ loginPage, page }) => {
    await loginPage.loginAs('super_admin');
    await page.goto('/admin/organizations');
    const badges = page.locator('[data-slot="business-id-badge"]');
    await expect(badges.first()).toBeVisible();

    const boxes = await badges.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ w: Math.round(r.width), h: Math.round(r.height) })));
    expect(boxes.length).toBeGreaterThan(0);
    const widths = [...new Set(boxes.map((b) => b.w))];
    expect(widths, 'wszystkie plakietki ID tej samej szerokości').toHaveLength(1);
    expect(widths[0]).toBeLessThanOrEqual(120);
    for (const b of boxes) expect(b.h, 'wysokość jak plakietka statusu (text-xs, py-0.5)').toBeLessThanOrEqual(22);

    // ID i przycisk kopiowania mieszczą się w plakietce
    const first = badges.first();
    await expect(first.getByRole('button', { name: 'Kopiuj identyfikator' })).toBeVisible();
    const overflow = await first.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow, 'ID nie wychodzi poza plakietkę').toBe(false);
  });
});
