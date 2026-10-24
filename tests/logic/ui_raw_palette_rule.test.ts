import { describe, it, expect } from 'vitest';
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * ADR-017 pkt 4: zakaz surowej palety Tailwind (np. bg-amber-500, text-red-600, bg-amber/10)
 * w komponentach. Kolor pochodzi wyłącznie z tokenów kontraktu, więc nie może nieść oceny.
 * Ta sama reguła działa w hookach agentów i w CI: verify.sh krok 6 wywołuje checkWrite z guard-core.
 */
const COMPONENT = 'apps/web/src/components/Example.tsx';

describe('Reguła ui-raw-palette (ADR-017)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - reguła istnieje w sc.config i jest blokująca', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'ui-raw-palette');
    expect(rule).toBeDefined();
    expect(rule.severity).not.toBe('warn');
  });

  it('@REQ: MDR-NO-INTERPRETATION - blokuje surową paletę z numerem i bez numeru', () => {
    for (const cls of ['bg-amber-500', 'text-red-600', 'border-emerald-200', 'bg-amber/10', 'text-teal', 'ring-blue-500/50', 'from-rose-400']) {
      const res = checkWrite(COMPONENT, `<span className="inline-flex ${cls}">x</span>`);
      expect(res.blocked, cls).toBe(true);
      expect(res.rule, cls).toBe('ui-raw-palette');
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - przepuszcza tokeny kontraktu i biel na kolorze marki', () => {
    for (const cls of ['bg-primary/10 text-primary', 'bg-muted text-foreground', 'bg-destructive text-white', 'bg-white', 'text-muted-foreground', 'border-border', 'bg-chart-1/15']) {
      expect(checkWrite(COMPONENT, `<span className="${cls}">x</span>`).blocked, cls).toBe(false);
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - nie dotyczy testów ani wygenerowanych tokenów', () => {
    expect(checkWrite('e2e/roles/example.spec.ts', "const c = 'bg-amber-500'").blocked).toBe(false);
    expect(checkWrite('packages/contracts/src/generated/tokens.css', '.x { --a: bg-amber-500 }').blocked).toBe(false);
  });
});
