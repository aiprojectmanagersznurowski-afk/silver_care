import { describe, it, expect } from 'vitest';
import {
  validateLoginCredentials,
} from '../../apps/web/src/lib/ui-theme-validator';
import { validatePasswordStrength } from '../../apps/web/src/lib/password';
import { formatSectorName } from '../../apps/web/src/components/facility/RoomList';
import { ROLE_LABELS, AVAILABLE_ROLES } from '../../apps/web/src/components/iam/iam-types';
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * Testy wykonawcze dla ustaleń z audytów UI/UX:
 * 1. Ekran logowania: walidacja danych uwierzytelniających i siły hasła.
 * 2. Panel placówki: formatowanie nazw sektorów i deduplikacja prefiksu.
 * 3. Super Admin i IAM: polskie etykiety ról i blokada super_admin w kreatorze.
 * 4. Dostępność Mobile-First i cele dotykowe.
 */
describe('Wdrożenie audytów UI/UX (@REQ: UI-TEMPLATE-ALIGNMENT, @REQ: UI-ACCESSIBILITY)', () => {
  describe('1. Ekran logowania (/login)', () => {
    it('waliduje format adresu e-mail i obecność hasła @REQ: UI-ACCESSIBILITY', () => {
      expect(validateLoginCredentials('', '')).toEqual({
        valid: false,
        error: 'Podaj poprawny adres e-mail',
      });
      expect(validateLoginCredentials('invalid-email', 'pass')).toEqual({
        valid: false,
        error: 'Podaj poprawny adres e-mail',
      });
      expect(validateLoginCredentials('nurse@silvercare.pl', '')).toEqual({
        valid: false,
        error: 'Wprowadź hasło',
      });
      expect(validateLoginCredentials('nurse@silvercare.pl', 'Secret123!')).toEqual({
        valid: true,
      });
    });

    it('weryfikuje siłę hasła wg polityki bezpieczeństwa @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const weak = validatePasswordStrength('krotkie');
      expect(weak.valid).toBe(false);

      const strong = validatePasswordStrength('TrudneHaslo123!');
      expect(strong.valid).toBe(true);
    });
  });

  describe('2. Panel placówki i struktura pokoi', () => {
    it('formatSectorName deduplikuje prefiks Sektor w nazwach @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      // Jeśli nazwa nie posiada prefiksu, dodaje "Sektor "
      expect(formatSectorName('A')).toBe('Sektor A');
      // Jeśli nazwa już posiada prefiks "Sektor", nie duplikuje go (brak "Sektor Sektor B")
      expect(formatSectorName('Sektor B-Północ')).toBe('Sektor B-Północ');
      expect(formatSectorName('sektor C')).toBe('sektor C');
      expect(formatSectorName(null)).toBe('—');
      expect(formatSectorName(undefined)).toBe('—');
      expect(formatSectorName('')).toBe('—');
    });
  });

  describe('3. Super Admin i IAM', () => {
    it('IAM posiada czytelne polskie etykiety ról @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      expect(ROLE_LABELS.org_admin).toContain('Administrator Placówki');
      expect(ROLE_LABELS.nurse).toContain('Personel Opiekuńczy');
      expect(ROLE_LABELS.family).toContain('Członek Rodziny');
      expect(ROLE_LABELS.legal_guardian).toContain('Opiekun Prawny');
    });

    it('AVAILABLE_ROLES blokuje wybór roli super_admin w UI @REQ: UI-TEMPLATE-ALIGNMENT', () => {
      const roleIds = AVAILABLE_ROLES.map((r) => r.id);
      expect(roleIds).not.toContain('super_admin');
      expect(roleIds).toContain('org_admin');
      expect(roleIds).toContain('nurse');
    });
  });

  describe('4. Standardy dostępności', () => {
    it('zapewnia minimalny cel dotykowy 44px @REQ: UI-ACCESSIBILITY', () => {
      expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
    });
  });
});
