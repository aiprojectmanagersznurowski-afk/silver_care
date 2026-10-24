import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ListViewFrame } from '../../apps/web/src/components/patterns/ListViewFrame';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Ramka listy z przełącznikiem w nagłówku karty: oba warianty treści przychodzą z serwera,
 * a bez zapamiętanej preferencji widoczna jest tabela.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');

const render = () => renderToStaticMarkup(h(ListViewFrame as never, {
  storageKey: 'test_list_view',
  title: 'Administratorzy',
  description: 'Konta placówki.',
  actions: h('button', { type: 'button' }, 'Dodaj'),
  table: h('table', { 'data-testid': 'variant-table' }),
  grid: h('div', { 'data-testid': 'variant-grid' }),
}));

describe('ListViewFrame — lista z przełącznikiem w nagłówku karty', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - domyślnie pokazuje tabelę, nie kafelki', () => {
    const html = render();
    expect(html).toContain('data-testid="variant-table"');
    expect(html).not.toContain('data-testid="variant-grid"');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - przełącznik i akcje są w nagłówku ramki TableCard', () => {
    const html = render();
    const header = html.slice(html.indexOf('table-card-header'), html.indexOf('data-testid="variant-table"'));
    expect(html).toContain('data-slot="table-card"');
    expect(header).toContain('data-slot="view-toggle"');
    expect(header).toContain('<button type="button">Dodaj</button>');
    expect(header).toMatch(/<h2[^>]*>Administratorzy<\/h2>/);
  });
});
