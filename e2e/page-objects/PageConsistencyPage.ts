import { Page } from '@playwright/test';

/**
 * Page Object do audytu spójności ekranów (ADR-017): mierzy obliczone style wspólnych
 * komponentów, więc wykrywa ekran, który ma własny nagłówek zamiast PageHeader.
 * @REQ: UI-TEMPLATE-ALIGNMENT
 */
export interface HeaderSnapshot {
  headers: number;
  h1Total: number;
  h1InHeader: number;
  titleStyle: string;
  descriptionStyle: string | null;
}

export class PageConsistencyPage {
  constructor(private readonly page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async headerSnapshot(): Promise<HeaderSnapshot> {
    return this.page.evaluate(() => {
      const style = (el: Element | null) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return [cs.fontFamily, cs.fontSize, cs.fontWeight, cs.color].join(' | ');
      };
      const headers = document.querySelectorAll('[data-slot="page-header"]');
      const header = headers[0] ?? null;
      return {
        headers: headers.length,
        h1Total: document.querySelectorAll('h1').length,
        h1InHeader: header ? header.querySelectorAll('h1').length : 0,
        titleStyle: style(header?.querySelector('h1') ?? null) ?? 'brak',
        descriptionStyle: style(header?.querySelector('[data-slot="page-header-description"]') ?? null),
      };
    });
  }
}
