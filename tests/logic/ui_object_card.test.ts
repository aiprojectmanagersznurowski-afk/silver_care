import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ObjectCard, ObjectGrid } from '../../apps/web/src/components/patterns/ObjectCard';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Widok kafelkowy każdej listy obiektów składa się z tego samego kafelka:
 * tytuł, podtytuł, plakietki, lista „etykieta — wartość” i akcje w stopce.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');
const html = (el: unknown) => renderToStaticMarkup(el as never);

describe('ObjectCard — wspólny kafelek obiektu', () => {
  const full = html(h(ObjectCard as never, {
    title: 'Jan Kowalski',
    subtitle: 'jan@example.test',
    badges: h('span', { 'data-slot': 'status-badge' }, 'Aktywny'),
    meta: [{ label: 'Rola', value: 'Personel' }, { label: 'Ostatnie logowanie', value: 'Nigdy' }],
    actions: h('button', { type: 'button' }, 'Zarządzaj'),
  }));

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kafelek to karta z cieniem szablonu i jednym nagłówkiem h3', () => {
    expect(full).toContain('data-slot="object-card"');
    expect(full).toContain('data-slot="card"');
    expect(full.match(/<h3\b/g)).toHaveLength(1);
    expect(full).toMatch(/<h3[^>]*class="[^"]*text-base[^"]*font-medium[^"]*"[^>]*>Jan Kowalski<\/h3>/);
    expect(full).toMatch(/class="[^"]*text-muted-foreground[^"]*"[^>]*>jan@example\.test</);
  });

  it('@REQ: UI-ACCESSIBILITY - dane jako lista opisowa dl/dt/dd', () => {
    expect(full).toMatch(/<dl[^>]*>.*<dt[^>]*>Rola<\/dt><dd[^>]*>Personel<\/dd>.*<dt[^>]*>Ostatnie logowanie<\/dt><dd[^>]*>Nigdy<\/dd>.*<\/dl>/);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - plakietki pod tytułem, akcje w stopce oddzielonej linią', () => {
    expect(full).toMatch(/data-slot="object-card-badges"[^>]*>.*Aktywny/);
    expect(full).toMatch(/data-slot="object-card-actions"[^>]*class="[^"]*border-t[^"]*"[^>]*>.*Zarządzaj/);
    expect(full.indexOf('object-card-badges')).toBeLessThan(full.indexOf('<dl'));
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - bez opcjonalnych części brak pustych kontenerów', () => {
    const minimal = html(h(ObjectCard as never, { title: 'Pokój 101' }));
    for (const slot of ['object-card-badges', 'object-card-actions', '<dl']) expect(minimal).not.toContain(slot);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - siatka kafelków ma jeden układ kolumn na wszystkich ekranach', () => {
    const grid = html(h(ObjectGrid as never, null, h('div', null, 'x')));
    const cls = grid.match(/data-slot="object-grid"[^>]*class="([^"]+)"/)?.[1] ?? '';
    expect(cls.split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-1', 'gap-4', 'sm:grid-cols-2', 'xl:grid-cols-3']));
  });

  it('@REQ: UI-ACCESSIBILITY - żadna klasa poniżej 12px (ADR-020)', () => {
    expect(full).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/);
  });
});
