import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { RowActions } from '../../apps/web/src/components/patterns/RowActions';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Akcje wiersza tabeli jak w szablonie: jeden przycisk „⋯" (ghost, ikona, cel dotykowy z tokenu),
 * który rozwija menu. Ten sam komponent w każdej tabeli.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');
const html = (el: unknown) => renderToStaticMarkup(el as never);

describe('Menu akcji wiersza', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - przycisk „⋯" w stylu ghost z celem dotykowym z tokenu', () => {
    const out = html(h(RowActions as never, { actions: [{ label: 'Edytuj', onSelect: () => {} }] }));
    expect(out).toMatch(/<button[^>]*data-slot="row-actions"/);
    expect(out).toMatch(/data-slot="row-actions"[^>]*class="[^"]*size-touch/);
    expect(out).not.toMatch(/data-slot="row-actions"[^>]*class="[^"]*border-border/);
  });

  it('@REQ: UI-ACCESSIBILITY - przycisk ma etykietę dla czytnika ekranu', () => {
    const out = html(h(RowActions as never, { actions: [{ label: 'Edytuj', onSelect: () => {} }] }));
    expect(out).toContain('Otwórz menu');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - bez akcji nie renderuje pustego menu', () => {
    const out = html(h(RowActions as never, { actions: [] }));
    expect(out).not.toContain('data-slot="row-actions"');
  });
});
