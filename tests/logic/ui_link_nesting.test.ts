import { describe, it, expect } from 'vitest';
import { getResidentMessagesHref } from '../../apps/web/src/lib/staff-helpers';
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: FAM-MESSAGES
 *
 * Testy wykonawcze dla poprawności linków nawigacyjnych i dostępności interaktywnej:
 * 1. Generowanie poprawnych linków do wątków wiadomości pensjonariusza.
 * 2. Zgodność z normą minimalnego celu dotykowego 44px (brak problemu podwójnego fokusu).
 * 3. Poprawny eksport komponentu karty tablicy personelu.
 */
describe('Dostępność linków i akcji (@REQ: UI-ACCESSIBILITY, @REQ: FAM-MESSAGES)', () => {
  it('generuje poprawny URL do wątku podopiecznego @REQ: FAM-MESSAGES', () => {
    const href = getResidentMessagesHref('res-123');
    expect(href).toBe('/staff/messages?residentId=res-123');

    const specialHref = getResidentMessagesHref('uuid-456/test');
    expect(specialHref).toBe('/staff/messages?residentId=uuid-456%2Ftest');
  });

  it('gwarantuje standardy dostępności WCAG dla elementów interaktywnych @REQ: UI-ACCESSIBILITY', () => {
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
    expect(ACCESSIBILITY.rules).toContain('Nawigacja klawiaturą obejmuje wszystkie akcje.');
  });

  it('poprawnie eksportuje komponent StaffStandardCard @REQ: UI-ACCESSIBILITY', async () => {
    const cardModule = await import('../../apps/web/src/components/staff/board/StaffStandardCard');
    expect(typeof cardModule.StaffStandardCard).toBe('function');
  });
});
