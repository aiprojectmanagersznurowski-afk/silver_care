import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { getActiveImpersonation, isImpersonationSessionActive } from '../../apps/web/src/lib/impersonation-guards';

/**
 * @REQ: SUP-IMPERSONATION
 * @REQ: ORG-ISOLATION
 *
 * Ciasteczko impersonacji (TTL 1 h) musi należeć do zalogowanego super_admina, który je rozpoczął.
 * Wcześniej wystarczyło, że istnieje — po podglądzie placówki zwykły administrator w tej samej
 * przeglądarce widział maskowane, puste listy pensjonariuszy i tryb tylko do odczytu.
 */

const ROOT = resolve(__dirname, '../..');
const SUPER = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', app_metadata: { role: 'super_admin' } };
const ORG_ADMIN = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', app_metadata: { role: 'org_admin', organization_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } };

const session = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ targetAdminId: 'x', targetOrgId: 'y', targetOrgName: 'Placówka', adminEmail: '', impersonatorId: SUPER.id, startedAt: new Date().toISOString(), ...over });
const jar = (value?: string) => ({ get: (n: string) => (n === 'sc_impersonation' && value !== undefined ? { value } : undefined) });

describe('Powiązanie ciasteczka impersonacji z użytkownikiem (@REQ: SUP-IMPERSONATION)', () => {
  it('aktywne tylko dla super_admina, który rozpoczął sesję @REQ: SUP-IMPERSONATION', () => {
    expect(getActiveImpersonation(jar(session()), SUPER)?.targetOrgName).toBe('Placówka');
    expect(isImpersonationSessionActive(jar(session()), SUPER)).toBe(true);
  });

  it('zwykły administrator z pozostałym ciasteczkiem nie jest w trybie impersonacji @REQ: SUP-IMPERSONATION', () => {
    expect(isImpersonationSessionActive(jar(session()), ORG_ADMIN)).toBe(false);
    expect(isImpersonationSessionActive(jar(session({ impersonatorId: ORG_ADMIN.id })), ORG_ADMIN)).toBe(false);
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
    const old = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    const fresh = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    expect(isImpersonationSessionActive(jar(session({ startedAt: old })), SUPER)).toBe(false);
    expect(isImpersonationSessionActive(jar(session({ startedAt: fresh })), SUPER)).toBe(true);
  });
});

describe('Wszystkie miejsca używają powiązanej reguły (@REQ: SUP-IMPERSONATION)', () => {
  function scan(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? scan(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  }
  const SRC = join(ROOT, 'apps/web/src');
  const ALLOWED = ['lib/impersonation-guards.ts', 'actions/impersonation.ts', 'app/auth/signout/route.ts'];

  it('nikt poza modułem strażnika i akcją impersonacji nie czyta surowego ciasteczka @REQ: SUP-IMPERSONATION', () => {
    const offenders = scan(SRC)
      .filter((f) => !ALLOWED.includes(relative(SRC, f)))
      .filter((f) => /cookies?\w*\.get\(\s*['"]sc_impersonation['"]/.test(readFileSync(f, 'utf-8')))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it('wylogowanie usuwa ciasteczko impersonacji @REQ: SUP-IMPERSONATION', () => {
    const src = readFileSync(join(SRC, 'app/auth/signout/route.ts'), 'utf-8');
    expect(src).toMatch(/sc_impersonation/);
    expect(src).toMatch(/delete|maxAge:\s*0|expires/);
  });
});
