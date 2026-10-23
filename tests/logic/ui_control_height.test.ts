import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { buttonVariants } from '../../apps/web/src/components/ui/button';
import { Input } from '../../apps/web/src/components/ui/input';
import { NativeSelect } from '../../apps/web/src/components/ui/native-select';
import { InputGroup } from '../../apps/web/src/components/ui/input-group';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * ADR-018: każda kontrolka bazowa (przycisk, pole, wybór, grupa pola) ma wysokość celu
 * dotykowego z tokenu kontraktu — jeden rozmiar przycisków, pól i filtrów bez nadpisywania na ekranach.
 */
const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { renderToStaticMarkup } = requireWeb('react-dom/server') as typeof import('react-dom/server');
const { createElement: h } = requireWeb('react') as typeof import('react');
const html = (el: unknown) => renderToStaticMarkup(el as never);
const classes = (s: string) => s.split(/\s+/);

describe('Wysokość kontrolek bazowych z tokenu celu dotykowego (ADR-018)', () => {
  it('@REQ: UI-ACCESSIBILITY - przycisk domyślny h-touch, ikonowy size-touch', () => {
    expect(classes(buttonVariants({ size: 'default' }))).toContain('h-touch');
    expect(classes(buttonVariants({ size: 'icon' }))).toContain('size-touch');
    expect(classes(buttonVariants({ size: 'default' }))).not.toContain('h-8');
  });

  it('@REQ: UI-ACCESSIBILITY - pole tekstowe, wybór i grupa pola mają h-touch', () => {
    expect(html(h(Input as never, {}))).toMatch(/<input[^>]*class="[^"]*\bh-touch\b/);
    expect(html(h(NativeSelect as never, null))).toMatch(/<select[^>]*class="[^"]*\bh-touch\b/);
    expect(html(h(InputGroup as never, null))).toMatch(/data-slot="input-group"[^>]*class="[^"]*\bh-touch\b/);
  });
});
