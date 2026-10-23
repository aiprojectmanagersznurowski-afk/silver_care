import { describe, it, expect } from 'vitest';
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * ADR-018: cel dotykowy 38px ma jedno źródło — kontrakt → --sc-touch-target → --spacing-touch.
 * Kod używa wyłącznie klas min-h-touch / min-w-touch. Rozmiar wpisany na sztywno
 * (min-h-11, min-h-[44px] …) rozjechałby się z kontraktem przy kolejnej zmianie normy.
 */
const COMPONENT = 'apps/web/src/components/Example.tsx';

describe('Cel dotykowy z tokenu (ADR-018)', () => {
  it('@REQ: UI-ACCESSIBILITY - kontrakt ustala 38px', () => {
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('38px');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - reguła ui-touch-target-token istnieje i blokuje', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'ui-touch-target-token');
    expect(rule).toBeDefined();
    expect(rule.severity).not.toBe('warn');
  });

  it('@REQ: UI-ACCESSIBILITY - blokuje cel dotykowy wpisany na sztywno', () => {
    for (const cls of ['min-h-11', 'min-w-11', 'min-h-[44px]', 'min-w-[44px]', 'min-h-[38px]', 'min-h-[48px]']) {
      const res = checkWrite(COMPONENT, `<button className="inline-flex ${cls}">x</button>`);
      expect(res.blocked, cls).toBe(true);
      expect(res.rule, cls).toBe('ui-touch-target-token');
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - przepuszcza token i zwykłe wysokości', () => {
    for (const cls of ['min-h-touch min-w-touch', 'h-8', 'min-h-screen', 'min-h-0', 'min-h-[420px]', 'size-11']) {
      expect(checkWrite(COMPONENT, `<div className="${cls}">x</div>`).blocked, cls).toBe(false);
    }
  });
});
