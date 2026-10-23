import { describe, it, expect } from 'vitest';
import {
  COLORS,
  ACCESSIBILITY,
} from '@silvercare/contracts/src/generated/design';
import {
  resolveRoleDestination,
  validateAccessibilityStandards,
} from '../../apps/web/src/lib/ui-theme-validator';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-FOUR-STATES
 * @REQ: SEC-SESSION
 *
 * Testy wykonawcze dla odświeżonego systemu projektowego (shadcn):
 * 1. Dostępność i eksporty kluczowych komponentów bazowych UI.
 * 2. Neutralna paleta szablonu z jednym akcentem marki (ADR-019).
 * 3. Logika bezpiecznego kierowania ról po uwierzytelnieniu sesji (RBAC).
 */
describe('UI Design System Refresh & Session Routing', () => {
  it('@REQ: UI-ACCESSIBILITY - Komponenty UI bazowe poprawnie się eksportują', async () => {
    const checkboxModule = await import('../../apps/web/src/components/ui/checkbox');
    expect(typeof checkboxModule.Checkbox).toBe('function');

    const skeletonModule = await import('../../apps/web/src/components/ui/skeleton');
    expect(typeof skeletonModule.Skeleton).toBe('function');

    const tooltipModule = await import('../../apps/web/src/components/ui/tooltip');
    expect(typeof tooltipModule.Tooltip).toBe('function');

    const a11yResult = validateAccessibilityStandards(ACCESSIBILITY);
    expect(a11yResult.valid).toBe(true);
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('38px');
  });

  it('@REQ: UI-FOUR-STATES - motyw: neutralne tła szablonu, kolor marki wyłącznie jako akcent (ADR-019)', () => {
    expect(COLORS.light.accent.value).toBe('#2F6F5E');
    expect(COLORS.light.bg.value).toBe('#FFFFFF');
    expect(COLORS.light.text.value).toBe('#171717');
    expect(COLORS.light.border.value).toBe('#E5E5E5');
    expect(COLORS.dark.bg.value).toBe('#171717');
    expect(COLORS.light['accent-soft'].value).toBe('#F5F5F5');
    expect(COLORS.light['sidebar-accent'].value).toBe('#F5F5F5');
  });

  it('@REQ: SEC-SESSION - resolveRoleDestination poprawnie kieruje uprawnienia użytkownika (RBAC)', () => {
    // Administratorzy placówki i platformy
    expect(resolveRoleDestination('super_admin')).toBe('/admin');
    expect(resolveRoleDestination('org_admin')).toBe('/admin');
    expect(resolveRoleDestination('admin')).toBe('/admin');
    expect(resolveRoleDestination('facility_manager')).toBe('/admin');

    // Personel medyczny i opiekuńczy
    expect(resolveRoleDestination('nurse')).toBe('/staff');
    expect(resolveRoleDestination('caregiver')).toBe('/staff');
    expect(resolveRoleDestination('paramedic')).toBe('/staff');

    // Rodzina i opiekunowie prawni
    expect(resolveRoleDestination('family')).toBe('/dashboard');
    expect(resolveRoleDestination('legal_guardian')).toBe('/dashboard');

    // Nieznana / brakująca rola
    expect(resolveRoleDestination('unauthorized_user')).toContain('error');
    expect(resolveRoleDestination(undefined)).toContain('error');
  });
});
