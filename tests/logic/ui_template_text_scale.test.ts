import { describe, it, expect } from 'vitest';
import { buttonVariants } from '../../apps/web/src/components/ui/button';
import { badgeVariants } from '../../apps/web/src/components/ui/badge';
import { checkWrite } from '../../tools/guard-core.mjs';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * ADR-020: komponenty bazowe mają skalę tekstu szablonu shadcn-admin — 14px w treści,
 * 12px (text-xs) w plakietkach i najmniejszych przyciskach. Poniżej 12px nadal zakaz.
 */
const classes = (s: string) => s.split(/\s+/);

describe('Skala tekstu szablonu w komponentach bazowych (ADR-020)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - przycisk: domyślny text-sm, xs text-xs, sm text-[0.8rem] jak w szablonie', () => {
    expect(classes(buttonVariants({ size: 'default' }))).toContain('text-sm');
    expect(classes(buttonVariants({ size: 'xs' }))).toContain('text-xs');
    expect(classes(buttonVariants({ size: 'sm' }))).toContain('text-[0.8rem]');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - plakietka ui/badge ma text-xs jak w szablonie', () => {
    expect(classes(badgeVariants({}))).toContain('text-xs');
  });

  it('@REQ: UI-ACCESSIBILITY - text-xs dozwolony, rozmiary poniżej 12px zablokowane w kodzie aplikacji', () => {
    const file = 'apps/web/src/components/Example.tsx';
    expect(checkWrite(file, '<span className="text-xs">x</span>').blocked).toBe(false);
    for (const cls of ['text-[11px]', 'text-[10px]', 'text-[9px]']) {
      const res = checkWrite(file, `<span className="${cls}">x</span>`);
      expect(res.blocked, cls).toBe(true);
      expect(res.rule, cls).toBe('ui-micro-font');
    }
  });
});
