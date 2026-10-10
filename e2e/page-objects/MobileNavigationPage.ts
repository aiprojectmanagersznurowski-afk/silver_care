import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object do testowania responsywności menu i nawigacji.
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 */
export class MobileNavigationPage {
  readonly page: Page;

  // Portal rodziny
  readonly familyTopNav: Locator;
  readonly familyBottomNav: Locator;
  readonly familyTabsContainer: Locator;

  // Powłoka personelu / admina
  readonly sidebarTrigger: Locator;
  readonly mobileSheetContent: Locator;
  readonly sheetCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.familyTopNav = page.locator('header nav');
    this.familyBottomNav = page.locator('nav.fixed.bottom-0');
    this.familyTabsContainer = page.locator('div:has(> button:text("Podsumowanie"))');

    this.sidebarTrigger = page.locator('[data-slot="sidebar-trigger"]');
    this.mobileSheetContent = page.locator('[data-slot="sidebar"][data-mobile="true"]');
    this.sheetCloseButton = page.locator('[data-slot="sheet-close"], [data-slot="sidebar"][data-mobile="true"] button[aria-label="Close"], [data-slot="sidebar"][data-mobile="true"] button:has(svg.lucide-x)');
  }

  async setTabletViewport() {
    // iPad 820x1180 (pomiędzy 768px md a 1024px lg)
    await this.page.setViewportSize({ width: 820, height: 1180 });
  }

  async setMobileViewport() {
    // iPhone 14 / mobile 390x844
    await this.page.setViewportSize({ width: 390, height: 844 });
  }

  async setSmallMobileViewport() {
    // iPhone SE / wąski ekran 360x667
    await this.page.setViewportSize({ width: 360, height: 667 });
  }

  async expectFamilyNavigationAvailable() {
    // Nawigacja musi być dostępna albo na górze (desktop/tablet), albo na dole (mobilna)
    const isTopNavVisible = await this.familyTopNav.isVisible();
    const isBottomNavVisible = await this.familyBottomNav.isVisible();
    expect(isTopNavVisible || isBottomNavVisible).toBe(true);
  }

  async expectNoHorizontalOverflow() {
    const scrollWidth = await this.page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await this.page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // dopuszczalna tolerancja subpixelowa
  }
}
