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

export interface BadgeSnapshot {
  count: number;
  /** Kształt i typografia: promień, rozmiar i grubość fontu, odstępy wewnętrzne. */
  shapes: string[];
  /** Pary kolor tekstu / tło — przy dwóch tonach co najwyżej dwie. */
  tones: string[];
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

  /** Kolor tła strony, cień pierwszej widocznej karty i zmienna --accent-foreground (podświetlenie w menu). */
  async surfaceSnapshot(): Promise<{ bodyBg: string; cardShadow: string | null; accentForeground: string; foreground: string }> {
    return this.page.evaluate(() => {
      const card = [...document.querySelectorAll('[data-slot="card"]')].find((c) => (c as HTMLElement).offsetParent !== null);
      const root = getComputedStyle(document.documentElement);
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        cardShadow: card ? getComputedStyle(card).boxShadow : null,
        accentForeground: root.getPropertyValue('--accent-foreground').trim(),
        foreground: root.getPropertyValue('--foreground').trim(),
      };
    });
  }

  /** Obliczona minimalna wysokość i szerokość linku powrotu w nagłówku strony (cel dotykowy). */
  async backLinkTouchTarget(): Promise<{ minHeight: string; minWidth: string } | null> {
    return this.page.evaluate(() => {
      const el = document.querySelector('[data-slot="page-header-back"]');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { minHeight: cs.minHeight, minWidth: cs.minWidth };
    });
  }

  /** Widoczne tabele: ile leży poza wspólną ramką TableCard i jakie style mają ramki. */
  async tableSnapshot(): Promise<{ tables: number; outsideCard: string[]; frames: string[] }> {
    return this.page.evaluate(() => {
      const tables = [...document.querySelectorAll('table')].filter((t) => (t as HTMLElement).offsetParent !== null);
      const outsideCard = tables
        .filter((t) => !t.closest('[data-slot="table-card"]'))
        .map((t) => (t.querySelector('th')?.textContent ?? '').trim().slice(0, 30));
      const frames = new Set<string>();
      for (const card of document.querySelectorAll('[data-slot="table-card"]')) {
        const cs = getComputedStyle(card);
        frames.add([cs.borderTopLeftRadius, cs.borderTopWidth, cs.borderTopColor, cs.backgroundColor].join(' | '));
      }
      return { tables: tables.length, outsideCard, frames: [...frames] };
    });
  }

  async statusBadgeSnapshot(): Promise<BadgeSnapshot> {
    return this.page.evaluate(() => {
      const badges = [...document.querySelectorAll('[data-slot="status-badge"]')]
        .filter((el) => (el as HTMLElement).offsetParent !== null);
      const shapes = new Set<string>();
      const tones = new Set<string>();
      for (const el of badges) {
        const cs = getComputedStyle(el);
        shapes.add([cs.borderTopLeftRadius, cs.fontSize, cs.fontWeight, cs.paddingTop, cs.paddingLeft].join(' | '));
        tones.add(`${cs.color} / ${cs.backgroundColor}`);
      }
      return { count: badges.length, shapes: [...shapes], tones: [...tones] };
    });
  }
}
