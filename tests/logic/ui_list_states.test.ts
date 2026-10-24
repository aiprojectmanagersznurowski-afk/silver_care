import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ListEmpty, ListLoading, ListError } from '../../apps/web/src/components/patterns/ListState';
import { TableCard, TableStateRow } from '../../apps/web/src/components/patterns/TableCard';

/**
 * @REQ: UI-FOUR-STATES
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * ADR-017 pkt 5: wspólne stany list (pusty, ładowanie, błąd) i jedna ramka tabeli.
 * Stan błędu to błąd techniczny, więc jako jedyny używa tonu destructive.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');

const html = (el: unknown) => renderToStaticMarkup(el as never);

describe('Wspólne stany list (UI-FOUR-STATES)', () => {
  it('@REQ: UI-FOUR-STATES - pusty: tytuł text-sm jak w szablonie, opis i akcja; bez czerwieni', () => {
    const out = html(h(ListEmpty as never, { title: 'Brak zaproszeń', description: 'Zaproś bliskich.', action: h('button', { type: 'button' }, 'Zaproś') }));
    expect(out).toContain('data-slot="list-empty"');
    expect(out).toMatch(/class="[^"]*text-sm[^"]*font-medium[^"]*"[^>]*>Brak zaproszeń</);
    expect(out).toContain('Zaproś bliskich.');
    expect(out).toContain('<button type="button">Zaproś</button>');
    expect(out).not.toMatch(/destructive/);
  });

  it('@REQ: UI-ACCESSIBILITY - ładowanie: aria-busy, komunikat dla czytnika ekranu i szkielet wierszy', () => {
    const out = html(h(ListLoading as never, { label: 'Wczytywanie zaproszeń', rows: 4 }));
    expect(out).toContain('data-slot="list-loading"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toMatch(/role="status"/);
    expect(out).toContain('Wczytywanie zaproszeń');
    expect(out.match(/data-slot="skeleton"/g)).toHaveLength(4);
  });

  it('@REQ: UI-FOUR-STATES - błąd: role=alert, ton destructive tylko tutaj, domyślny tytuł bez zmyślonej treści', () => {
    const out = html(h(ListError as never, {}));
    expect(out).toContain('data-slot="list-error"');
    expect(out).toContain('role="alert"');
    expect(out).toMatch(/destructive/);
    expect(out).toContain('Nie udało się wczytać danych');
  });

  it('@REQ: UI-ACCESSIBILITY - żaden stan nie schodzi poniżej 12px (ADR-020)', () => {
    for (const el of [h(ListEmpty as never, { title: 'T', description: 'D' }), h(ListLoading as never, {}), h(ListError as never, { description: 'D' })]) {
      expect(html(el)).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/);
    }
  });
});

describe('TableCard — jedna ramka tabeli', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - ramka: zaokrąglenie xl, obramowanie border, tło karty', () => {
    const out = html(h(TableCard as never, null, h('table', null)));
    const cls = out.match(/data-slot="table-card"[^>]*class="([^"]+)"/)?.[1] ?? out.match(/class="([^"]+)"[^>]*data-slot="table-card"/)?.[1] ?? '';
    expect(cls.split(' ')).toEqual(expect.arrayContaining(['rounded-xl', 'border', 'border-border', 'bg-card', 'overflow-hidden']));
    expect(out).toContain('<table>');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - nagłówek karty tabeli: h2, opis, ikona neutralna, akcje; bez tytułu brak nagłówka', () => {
    const out = html(h(TableCard as never, {
      title: 'Użytkownicy i Role',
      description: 'Konta i uprawnienia.',
      icon: h('svg', null),
      actions: h('button', { type: 'button' }, 'Dodaj'),
    }, h('table', null)));
    expect(out).toContain('data-slot="table-card-header"');
    expect(out).toMatch(/<h2 class="[^"]*text-lg[^"]*font-semibold[^"]*">Użytkownicy i Role<\/h2>/);
    expect(out).toMatch(/<p class="[^"]*text-muted-foreground[^"]*">Konta i uprawnienia\.<\/p>/);
    expect(out).toMatch(/data-slot="table-card-icon"[^>]*class="[^"]*bg-muted[^"]*"/);
    expect(out).toContain('<button type="button">Dodaj</button>');
    expect(out.indexOf('table-card-header')).toBeLessThan(out.indexOf('<table>'));
    expect(html(h(TableCard as never, null, h('table', null)))).not.toContain('table-card-header');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - pasek narzędzi w nagłówku karty, oddzielony linią, przed treścią (układ listy szablonu)', () => {
    const out = html(h(TableCard as never, { toolbar: h('input', { type: 'search' }) }, h('table', null)));
    expect(out).toMatch(/data-slot="table-card-toolbar"[^>]*class="[^"]*border-b[^"]*"/);
    expect(out.indexOf('table-card-toolbar')).toBeLessThan(out.indexOf('<table>'));
    expect(html(h(TableCard as never, null, h('table', null)))).not.toContain('table-card-toolbar');
  });

  it('@REQ: UI-FOUR-STATES - TableStateRow rozciąga stan na wszystkie kolumny', () => {
    const empty = html(h('table', null, h('tbody', null, h(TableStateRow as never, { colSpan: 5, state: 'empty', title: 'Brak danych' }))));
    expect(empty).toMatch(/<td[^>]*colSpan="5"|<td[^>]*colspan="5"/);
    expect(empty).toContain('data-slot="list-empty"');
    const loading = html(h('table', null, h('tbody', null, h(TableStateRow as never, { colSpan: 3, state: 'loading' }))));
    expect(loading).toContain('data-slot="list-loading"');
    const error = html(h('table', null, h('tbody', null, h(TableStateRow as never, { colSpan: 3, state: 'error' }))));
    expect(error).toContain('data-slot="list-error"');
  });
});
