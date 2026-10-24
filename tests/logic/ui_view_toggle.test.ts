import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ViewToggle, GRID_TABLE_OPTIONS } from '../../apps/web/src/components/patterns/ViewToggle';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Każdy widok listy obiektów ma ten sam przełącznik kafelki/tabela (domyślnie tabela).
 * Jeden komponent zamiast pięciu różnych implementacji; stan wybrany ogłaszany przez aria-pressed.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement } = requireWeb('react') as typeof import('react');

const render = (value: string) =>
  renderToStaticMarkup(createElement(ViewToggle as never, { value, onChange: () => {}, options: GRID_TABLE_OPTIONS }));
const buttons = (html: string) => html.match(/<button[^>]*>/g) ?? [];

describe('ViewToggle — wspólny przełącznik widoku', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - domyślne opcje: najpierw Tabela, potem Kafelki', () => {
    expect(GRID_TABLE_OPTIONS.map((o) => o.value)).toEqual(['table', 'grid']);
    const html = render('table');
    expect(html).toContain('data-slot="view-toggle"');
    expect(html.indexOf('Tabela')).toBeLessThan(html.indexOf('Kafelki'));
  });

  it('@REQ: UI-ACCESSIBILITY - grupa z etykietą, wybrany przycisk ma aria-pressed=true', () => {
    const html = render('table');
    expect(html).toMatch(/role="group"[^>]*aria-label="Tryb widoku"|aria-label="Tryb widoku"[^>]*role="group"/);
    const [table, grid] = buttons(html);
    expect(table).toContain('aria-pressed="true"');
    expect(table).toContain('aria-label="Widok tabeli"');
    expect(grid).toContain('aria-pressed="false"');
    expect(grid).toContain('aria-label="Widok kafelków"');
  });

  it('@REQ: UI-ACCESSIBILITY - każdy przycisk ma cel dotykowy z tokenu i typ button', () => {
    for (const b of buttons(render('grid'))) {
      expect(b).toContain('min-h-touch');
      expect(b).toContain('type="button"');
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - zmiana wyboru zmienia wyłącznie ton, nie kształt', () => {
    const shape = (b: string) => (b.match(/class="([^"]+)"/)?.[1] ?? '').split(' ').filter((c) => !/^(bg-|text-|hover:)/.test(c)).sort().join(' ');
    const [tA, gA] = buttons(render('table'));
    const [tB, gB] = buttons(render('grid'));
    expect(shape(tA)).toBe(shape(gA));
    expect(shape(tA)).toBe(shape(tB));
    expect(shape(gA)).toBe(shape(gB));
  });
});
