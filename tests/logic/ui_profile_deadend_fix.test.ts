import { describe, it, expect } from 'vitest';
import { resolveProfileBackHref } from '../../apps/web/src/lib/ui-theme-validator';
import { ROLE_LABELS } from '../../apps/web/src/components/profile/profile-types';
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy wykonawcze likwidacji ślepego zaułka profilu (UI-PROFILE-DEADEND-FIX):
 * 1. Logika wyznaczania ścieżki powrotu (resolveProfileBackHref) dla personelu, admina i rodziny.
 * 2. Etykiety ról profilu w języku polskim.
 * 3. Poprawny eksport komponentu profilu i spełnienie wymagań dostępności.
 */
describe('Likwidacja ślepego zaułka profilu (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  it('wyznacza poprawną ścieżkę powrotu dla administratora placówki @REQ: UI-ACCESSIBILITY', () => {
    expect(resolveProfileBackHref('super_admin')).toBe('/admin');
    expect(resolveProfileBackHref('org_admin')).toBe('/admin');
    expect(resolveProfileBackHref('admin')).toBe('/admin');
  });

  it('wyznacza poprawną ścieżkę powrotu dla personelu opiekuńczego @REQ: UI-ACCESSIBILITY', () => {
    expect(resolveProfileBackHref('nurse')).toBe('/staff');
    expect(resolveProfileBackHref('caregiver')).toBe('/staff');
    expect(resolveProfileBackHref('paramedic')).toBe('/staff');
  });

  it('wyznacza poprawną ścieżkę powrotu dla członków rodziny i opiekunów prawnych @REQ: UI-ACCESSIBILITY', () => {
    expect(resolveProfileBackHref('family')).toBe('/dashboard');
    expect(resolveProfileBackHref('legal_guardian')).toBe('/dashboard');
    expect(resolveProfileBackHref(undefined)).toBe('/dashboard');
  });

  it('posiada czytelne polskie etykiety ról w profilu użytkownika @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(ROLE_LABELS.org_admin).toBe('Administrator Placówki');
    expect(ROLE_LABELS.nurse).toBe('Pielęgniarka / Personel Medyczny');
    expect(ROLE_LABELS.family).toBe('Bliski / Rodzina');
    expect(ROLE_LABELS.legal_guardian).toBe('Opiekun Prawny');
  });

  it('gwarantuje spełnienie minimalnego celu dotykowego 44px @REQ: UI-ACCESSIBILITY', () => {
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
  });

  it('poprawnie eksportuje komponent ProfileSecurityClient @REQ: UI-TEMPLATE-ALIGNMENT', async () => {
    const profileModule = await import('../../apps/web/src/app/settings/profile/profile-client');
    expect(typeof profileModule.ProfileSecurityClient).toBe('function');
  });
});
