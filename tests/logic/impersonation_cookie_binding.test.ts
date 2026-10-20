import { describe, it, expect } from 'vitest';
import {
  getActiveImpersonation,
  isImpersonationSessionActive,
  assertMutationAllowedDuringImpersonation,
  maskResidentListForImpersonation,
  IMPERSONATION_TTL_MS,
} from '../../apps/web/src/lib/impersonation-guards';

/**
 * @REQ: SUP-IMPERSONATION
 * @REQ: ORG-ISOLATION
 *
 * Ciasteczko impersonacji (TTL 1 h) musi należeć do zalogowanego super_admina, który je rozpoczął.
 * Zwykły administrator lub konto innej roli nie może wejść w tryb podglądu ani zobaczyć cudzych danych.
 * Wszelkie mutacje danych w trybie impersonacji są bezwzględnie blokowane (Read-Only).
 */

const SUPER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', app_metadata: { role: 'super_admin' } };
const ORG_ADMIN = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', app_metadata: { role: 'org_admin', organization_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } };
const NURSE = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', app_metadata: { role: 'nurse', organization_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } };

const session = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ targetAdminId: 'x', targetOrgId: 'y', targetOrgName: 'Placówka', adminEmail: '', impersonatorId: SUPER.id, startedAt: new Date().toISOString(), ...over });
const jar = (value?: string) => ({ get: (n: string) => (n === 'sc_impersonation' && value !== undefined ? { value } : undefined) });

describe('Powiązanie ciasteczka impersonacji z użytkownikiem (@REQ: SUP-IMPERSONATION, @REQ: ORG-ISOLATION)', () => {
  it('aktywne tylko dla super_admina, który rozpoczął sesję @REQ: SUP-IMPERSONATION', () => {
    expect(getActiveImpersonation(jar(session()), SUPER)?.targetOrgName).toBe('Placówka');
    expect(isImpersonationSessionActive(jar(session()), SUPER)).toBe(true);
  });

  it('zwykły administrator z pozostałym ciasteczkiem nie jest w trybie impersonacji @REQ: SUP-IMPERSONATION', () => {
    expect(isImpersonationSessionActive(jar(session()), ORG_ADMIN)).toBe(false);
    expect(isImpersonationSessionActive(jar(session({ impersonatorId: ORG_ADMIN.id })), ORG_ADMIN)).toBe(false);
  });

  it('personel medyczny i opiekuńczy nie może aktywować trybu podglądu @REQ: ORG-ISOLATION', () => {
    expect(isImpersonationSessionActive(jar(session()), NURSE)).toBe(false);
    expect(isImpersonationSessionActive(jar(session({ impersonatorId: NURSE.id })), NURSE)).toBe(false);
  });

  it('ciasteczko innego super_admina nie działa @REQ: SUP-IMPERSONATION', () => {
    const other = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', app_metadata: { role: 'super_admin' } };
    expect(isImpersonationSessionActive(jar(session()), other)).toBe(false);
  });

  it('brak zalogowanego użytkownika, brak ciasteczka i zepsuty JSON dają „nieaktywne" @REQ: SUP-IMPERSONATION', () => {
    expect(isImpersonationSessionActive(jar(session()), null)).toBe(false);
    expect(isImpersonationSessionActive(jar(undefined), SUPER)).toBe(false);
    expect(isImpersonationSessionActive(jar('{nie-json'), SUPER)).toBe(false);
    expect(isImpersonationSessionActive(jar(JSON.stringify({ foo: 1 })), SUPER)).toBe(false);
  });

  it('sesja starsza niż godzina wygasa także po stronie serwera @REQ: SUP-IMPERSONATION', () => {
    expect(IMPERSONATION_TTL_MS).toBe(3600000);
    const old = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    const fresh = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    expect(isImpersonationSessionActive(jar(session({ startedAt: old })), SUPER)).toBe(false);
    expect(isImpersonationSessionActive(jar(session({ startedAt: fresh })), SUPER)).toBe(true);
  });

  it('blokuje wszelkie mutacje danych w trybie podglądu placówki (fail-closed) @REQ: SUP-IMPERSONATION', () => {
    const blocked = assertMutationAllowedDuringImpersonation(true);
    expect(blocked.allowed).toBe(false);
    expect(blocked.status).toBe(403);
    expect(blocked.error).toContain('Read-Only');

    const allowed = assertMutationAllowedDuringImpersonation(false);
    expect(allowed.allowed).toBe(true);
    expect(allowed.error).toBeUndefined();
  });

  it('maskuje dane pensjonariuszy podczas aktywnej impersonacji @REQ: ORG-ISOLATION', () => {
    const rawResidents = [{ id: 'res-1', name: 'Jan' }, { id: 'res-2', name: 'Anna' }];
    const masked = maskResidentListForImpersonation(rawResidents, true);
    expect(masked.masked).toBe(true);
    expect(masked.residents).toHaveLength(0);
    expect(masked.count).toBe(2);

    const unmasked = maskResidentListForImpersonation(rawResidents, false);
    expect(unmasked.masked).toBe(false);
    expect(unmasked.residents).toEqual(rawResidents);
    expect(unmasked.count).toBe(2);
  });
});
