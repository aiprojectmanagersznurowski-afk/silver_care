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

  /**
   * Kontrasty przycisków filtrów i przycisków obrysowych względem karty, na której leżą.
   * Kolory zamieniane na RGB przez canvas, bo Tailwind v4 zwraca oklab()/oklch().
   */
  async buttonContrasts(): Promise<{ label: string; text: number; border: number }[]> {
    return this.page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgb = (css: string, under: [number, number, number]) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = `rgb(${under.join(',')})`; ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b] as [number, number, number];
      };
      const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const buttons = [...document.querySelectorAll('main [data-slot="filter-chip"], main [data-slot="table-card"] a, main [data-slot="table-card"] button')]
        .filter((b) => (b as HTMLElement).offsetParent !== null && getComputedStyle(b).borderTopWidth !== '0px');
      return buttons.slice(0, 20).map((b) => {
        const card = b.closest('[data-slot="table-card"]') ?? document.body;
        const cardRgb = rgb(getComputedStyle(card).backgroundColor, [255, 255, 255]);
        const cs = getComputedStyle(b);
        const bg = rgb(cs.backgroundColor, cardRgb);
        return {
          label: (b.textContent ?? '').trim().slice(0, 24),
          text: Math.round(ratio(rgb(cs.color, bg), bg) * 100) / 100,
          border: Math.round(ratio(rgb(cs.borderTopColor, cardRgb), cardRgb) * 100) / 100,
        };
      });
    });
  }

  /** Ramki kart (promień, cień, tło) i typografia tytułów kart w treści strony. */
  async cardSnapshot(): Promise<{ frames: string[]; titles: string[] }> {
    return this.page.evaluate(() => {
      const visible = (sel: string) => [...document.querySelectorAll(sel)].filter((e) => (e as HTMLElement).offsetParent !== null);
      const frames = new Set<string>();
      const titles = new Set<string>();
      for (const c of visible('main [data-slot="card"]')) {
        const cs = getComputedStyle(c);
        frames.add([cs.borderTopLeftRadius, cs.boxShadow, cs.backgroundColor].join(' | '));
      }
      for (const t of visible('main [data-slot="card-title"]')) {
        const cs = getComputedStyle(t);
        titles.add([cs.fontSize, cs.fontWeight].join(' | '));
      }
      return { frames: [...frames], titles: [...titles] };
    });
  }

  /** Wyszukiwarki i przyciski filtrów: ile jest i jakie mają kształty (wysokość, promień, obramowanie). */
  async toolbarSnapshot(): Promise<{ searchFields: number; searchShapes: string[]; chips: number; chipShapes: string[] }> {
    return this.page.evaluate(() => {
      const shape = (el: Element) => {
        const cs = getComputedStyle(el);
        return [Math.round(el.getBoundingClientRect().height), cs.borderTopLeftRadius, cs.borderTopWidth].join(' | ');
      };
      const visible = (sel: string) => [...document.querySelectorAll(sel)].filter((e) => (e as HTMLElement).offsetParent !== null);
      const fields = visible('main [data-slot="search-field"]');
      const chips = visible('main [data-slot="filter-chip"]');
      return {
        searchFields: fields.length,
        searchShapes: [...new Set(fields.map(shape))],
        chips: chips.length,
        chipShapes: [...new Set(chips.map((c) => shape(c).split(' | ')[0]))],
      };
    });
  }

  /** Wysokości wierszy danych, nagłówków i odstępy komórek w widocznych tabelach (bez wierszy stanu). */
  async tableRowMetrics(): Promise<{ rowHeights: number[]; headHeights: number[]; cellPaddings: string[] }> {
    return this.page.evaluate(() => {
      const tables = [...document.querySelectorAll('main table')].filter((t) => (t as HTMLElement).offsetParent !== null);
      const rowHeights: number[] = [];
      const headHeights: number[] = [];
      const cellPaddings = new Set<string>();
      for (const t of tables) {
        const th = t.querySelector('thead th');
        if (th) headHeights.push(Math.round(th.getBoundingClientRect().height));
        for (const tr of t.querySelectorAll('tbody tr')) {
          if (tr.querySelector('td[colspan]')) continue;
          rowHeights.push(Math.round(tr.getBoundingClientRect().height));
          const td = tr.querySelector('td');
          if (td) { const cs = getComputedStyle(td); cellPaddings.add(`${cs.paddingTop} ${cs.paddingLeft}`); }
        }
      }
      return { rowHeights, headHeights, cellPaddings: [...cellPaddings] };
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
