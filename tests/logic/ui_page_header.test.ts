import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { PageHeader } from '../../apps/web/src/components/patterns/PageHeader';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * ADR-017 pkt 5: każdy ekran ma ten sam nagłówek strony — jeden h1, opis w kolorze
 * pomocniczym, akcje po prawej, powrót z celem dotykowym 38px (ADR-018). Test renderuje komponent.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement } = requireWeb('react') as typeof import('react');

const render = (props: Parameters<typeof PageHeader>[0]) => renderToStaticMarkup(createElement(PageHeader, props));

describe('PageHeader — wspólny nagłówek strony (ADR-017)', () => {
  it('@REQ: UI-ACCESSIBILITY - renderuje dokładnie jeden h1 z tytułem', () => {
    const html = render({ title: 'Podopieczni' });
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Podopieczni<\/h1>/);
    expect(html).toContain('data-slot="page-header"');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - tytuł ma jedną typografię: font-display, 2xl na telefonie, 3xl od sm', () => {
    const h1 = render({ title: 'Personel' }).match(/<h1 class="([^"]+)"/)?.[1] ?? '';
    for (const cls of ['font-display', 'font-semibold', 'tracking-tight', 'text-foreground', 'text-2xl', 'sm:text-3xl']) {
      expect(h1.split(' ')).toContain(cls);
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - opis w kolorze pomocniczym, bez opisu brak pustego akapitu', () => {
    const withDesc = render({ title: 'Personel', description: 'Zespół placówki.' });
    expect(withDesc).toMatch(/<p[^>]*data-slot="page-header-description"[^>]*>Zespół placówki\.<\/p>/);
    expect(withDesc).toMatch(/data-slot="page-header-description"[^>]*class="[^"]*text-muted-foreground/);
    expect(render({ title: 'Personel' })).not.toContain('page-header-description');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - akcje trafiają do jednego kontenera, bez akcji go nie ma', () => {
    const html = render({ title: 'Personel', actions: createElement('button', { type: 'button' }, 'Zaproś') });
    expect(html).toMatch(/data-slot="page-header-actions"[^>]*>.*<button type="button">Zaproś<\/button>/);
    expect(render({ title: 'Personel' })).not.toContain('page-header-actions');
  });

  it('@REQ: UI-ACCESSIBILITY - link powrotu ma cel dotykowy 38px (ADR-018) i prowadzi pod wskazany adres', () => {
    const html = render({ title: 'Raporty', back: { href: '/staff', label: 'Wróć do listy podopiecznych' } });
    const link = html.match(/<a [^>]*data-slot="page-header-back"[^>]*>/)?.[0] ?? '';
    expect(link).toContain('href="/staff"');
    expect(link).toContain('min-h-touch');
    expect(html).toContain('Wróć do listy podopiecznych');
  });

  it('@REQ: UI-ACCESSIBILITY - opis text-sm jak w szablonie, żadna klasa poniżej 12px (ADR-020)', () => {
    const html = render({ title: 'T', description: 'D', back: { href: '/x', label: 'Wróć' } });
    expect(html).toMatch(/data-slot="page-header-description" class="[^"]*text-sm/);
    expect(html).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/);
  });
});
