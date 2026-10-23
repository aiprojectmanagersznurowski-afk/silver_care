import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ListToolbar, SearchField, FilterChip, FilterGroup } from '../../apps/web/src/components/patterns/ListToolbar';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Pasek nad listą jak w szablonie shadcn-admin: wyszukiwarka, filtry i akcje w jednym układzie,
 * jeden rozmiar pól i przycisków filtrów (cel dotykowy z tokenu), zaznaczenie przez aria-pressed.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');
const html = (el: unknown) => renderToStaticMarkup(el as never);
const noop = () => {};

describe('ListToolbar — wspólny pasek listy', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - układ szablonu: część główna i część końcowa', () => {
    const out = html(h(ListToolbar as never, { end: h('span', null, 'koniec') }, h('span', null, 'filtry')));
    expect(out).toContain('data-slot="list-toolbar"');
    expect(out).toMatch(/data-slot="list-toolbar-main"[^>]*>.*filtry/);
    expect(out).toMatch(/data-slot="list-toolbar-end"[^>]*>.*koniec/);
  });

  it('@REQ: UI-ACCESSIBILITY - wyszukiwarka: etykieta, typ search, wysokość z tokenu, szerokość sm:w-64', () => {
    const out = html(h(SearchField as never, { value: '', onChange: noop, placeholder: 'Szukaj podopiecznego...', label: 'Szukaj podopiecznego' }));
    expect(out).toContain('data-slot="search-field"');
    expect(out).toMatch(/<input[^>]*type="search"/);
    expect(out).toMatch(/<input[^>]*aria-label="Szukaj podopiecznego"/);
    expect(out).toMatch(/data-slot="search-field"[^>]*class="[^"]*h-touch[^"]*sm:w-64/);
  });

  it('@REQ: UI-ACCESSIBILITY - przycisk czyszczenia tylko przy wpisanej frazie, z etykietą i celem dotykowym', () => {
    expect(html(h(SearchField as never, { value: '', onChange: noop, label: 'Szukaj' }))).not.toContain('Wyczyść wyszukiwanie');
    const filled = html(h(SearchField as never, { value: 'Jan', onChange: noop, label: 'Szukaj' }));
    expect(filled).toMatch(/<button[^>]*aria-label="Wyczyść wyszukiwanie"/);
  });

  it('@REQ: UI-ACCESSIBILITY - filtr: aria-pressed, cel dotykowy z tokenu, wybrany w kolorze marki', () => {
    const on = html(h(FilterChip as never, { active: true, onClick: noop }, 'Szkic'));
    const off = html(h(FilterChip as never, { active: false, onClick: noop }, 'Szkic'));
    expect(on).toContain('aria-pressed="true"');
    expect(off).toContain('aria-pressed="false"');
    expect(on).toContain('data-slot="filter-chip"');
    for (const b of [on, off]) expect(b).toContain('min-h-touch');
    expect(on).toContain('bg-primary');
    expect(off).not.toContain('bg-primary');
  });

  it('@REQ: UI-ACCESSIBILITY - grupa filtrów ma etykietę dla czytnika ekranu', () => {
    const out = html(h(FilterGroup as never, { label: 'Status', name: 'status' }, h('button', { type: 'button' }, 'x')));
    expect(out).toMatch(/role="group"[^>]*aria-label="Status"|aria-label="Status"[^>]*role="group"/);
    expect(out).toContain('data-filter-group="status"');
  });
});
