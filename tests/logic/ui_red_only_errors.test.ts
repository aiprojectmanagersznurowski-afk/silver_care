import { describe, it, expect } from 'vitest';
import { confirmButtonVariant } from '../../apps/web/src/components/ui/confirm-dialog';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * ADR-017 pkt 2 (decyzja 2026-10-22): czerwień wyłącznie dla błędów technicznych.
 * Potwierdzenie akcji nieodwracalnej (usuń, odwołaj, wypisz, zgon) nie jest błędem,
 * więc przycisk potwierdzenia ma kolor marki niezależnie od wariantu okna.
 */
describe('ConfirmDialog — przycisk potwierdzenia bez czerwieni', () => {
  it('@REQ: MDR-NO-INTERPRETATION - wariant destructive potwierdza przyciskiem w kolorze marki', () => {
    expect(confirmButtonVariant('destructive')).toBe('default');
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - wariant domyślny bez zmian', () => {
    expect(confirmButtonVariant('default')).toBe('default');
    expect(confirmButtonVariant(undefined)).toBe('default');
  });
});
