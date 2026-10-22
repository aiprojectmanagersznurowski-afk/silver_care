import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { StatusBadge } from '../../apps/web/src/components/patterns/StatusBadge';
import { getResidentStatus } from '../../apps/web/src/lib/resident-status';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * ADR-017 pkt 3 i 5: jedna plakietka statusu w dwóch tonach (neutralny, kolor marki).
 * Czerwień zostaje dla błędów technicznych, więc plakietka nie ma tonu ostrzegawczego.
 * Status pensjonariusza liczy jedna funkcja, żeby tabela, kafelki i karta mobilna mówiły to samo.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement } = requireWeb('react') as typeof import('react');

const render = (props: Record<string, unknown>, text = 'Aktywny') =>
  renderToStaticMarkup(createElement(StatusBadge as never, props, text));
const classesOf = (html: string) => (html.match(/class="([^"]+)"/)?.[1] ?? '').split(' ');

describe('StatusBadge — wspólna plakietka statusu (ADR-017)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - domyślnie ton neutralny: tło muted, tekst foreground', () => {
    const html = render({});
    expect(html).toContain('data-slot="status-badge"');
    expect(html).toContain('data-tone="neutral"');
    expect(classesOf(html)).toEqual(expect.arrayContaining(['bg-muted', 'text-foreground']));
    expect(html).toContain('>Aktywny<');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - ton marki: tło primary/10, tekst primary', () => {
    const html = render({ tone: 'brand' });
    expect(html).toContain('data-tone="brand"');
    expect(classesOf(html)).toEqual(expect.arrayContaining(['bg-primary/10', 'text-primary']));
  });

  it('@REQ: MDR-NO-INTERPRETATION - żaden ton nie używa czerwieni ani surowej palety Tailwind', () => {
    for (const tone of ['neutral', 'brand']) {
      const html = render({ tone });
      expect(html).not.toMatch(/destructive/);
      expect(html).not.toMatch(/\b(?:bg|text|border)-(?:red|amber|yellow|orange|green|emerald|rose|blue|sky)-\d{2,3}\b/);
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kształt i typografia identyczne w obu tonach, min. 14px', () => {
    const shape = (tone: string) => classesOf(render({ tone })).filter((c) => !/^(bg|text)-(muted|foreground|primary)/.test(c)).sort();
    expect(shape('neutral')).toEqual(shape('brand'));
    expect(classesOf(render({}))).toContain('text-sm');
    expect(render({})).not.toMatch(/text-xs|text-\[1[0-3]px\]/);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - przekazuje atrybuty (data-testid) i nie pozwala nadpisać koloru klasą', () => {
    const html = render({ 'data-testid': 'report-status-published', className: 'bg-destructive' });
    expect(html).toContain('data-testid="report-status-published"');
    expect(html).not.toContain('bg-destructive');
  });
});

describe('getResidentStatus — jeden status pensjonariusza w całej aplikacji', () => {
  const now = new Date('2026-10-22T12:00:00Z');

  it('@REQ: UI-TEMPLATE-ALIGNMENT - kolejność: archiwum, zgon, wypis, aktywny', () => {
    expect(getResidentStatus({ archived_at: '2026-01-01', death_date: '2026-01-01' }, now)).toEqual({ kind: 'archived', label: 'Zarchiwizowany' });
    expect(getResidentStatus({ death_date: '2026-05-01', contract_end_date: '2026-05-01' }, now)).toEqual({ kind: 'deceased', label: 'Zgon' });
    expect(getResidentStatus({ contract_end_date: '2026-10-01' }, now)).toEqual({ kind: 'discharged', label: 'Wypisany' });
    expect(getResidentStatus({}, now)).toEqual({ kind: 'active', label: 'Aktywny' });
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - umowa kończąca się w przyszłości nie oznacza wypisu', () => {
    expect(getResidentStatus({ contract_end_date: '2026-12-31' }, now).kind).toBe('active');
  });
});
