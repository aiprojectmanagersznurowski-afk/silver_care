import { describe, it, expect } from 'vitest';
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs';

/**
 * @REQ: SEC-SESSION
 *
 * WO-NFR-PERF-SCREEN-LOAD, etap 2 (H1): jedna weryfikacja tożsamości na renderowanie strony.
 * Layout i strona paneli biorą użytkownika z getCurrentUser() (React.cache) zamiast osobnego
 * supabase.auth.getUser() — każde to zapytanie sieciowe do Supabase Auth. Weryfikacja zostaje
 * po stronie serwera (getUser), zmienia się tylko liczba wywołań w jednym żądaniu.
 */
describe('Reguła jednej weryfikacji tożsamości na stronę (perf-single-auth)', () => {
  it('@REQ: SEC-SESSION - reguła istnieje i jest blokująca', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'perf-single-auth');
    expect(rule).toBeDefined();
    expect(rule.severity).not.toBe('warn');
  });

  it('@REQ: SEC-SESSION - layout i strona paneli nie wołają auth.getUser() bezpośrednio', () => {
    for (const path of ['apps/web/src/app/(admin)/layout.tsx', 'apps/web/src/app/(admin)/admin/residents/page.tsx',
      'apps/web/src/app/(staff)/layout.tsx', 'apps/web/src/app/(family)/dashboard/page.tsx']) {
      const res = checkWrite(path, 'const { data: { user } } = await supabase.auth.getUser()');
      expect(res.rule, path).toBe('perf-single-auth');
    }
  });

  it('@REQ: SEC-SESSION - getCurrentUser jest dozwolone; akcje serwerowe i trasy API bez zmian', () => {
    expect(checkWrite('apps/web/src/app/(admin)/layout.tsx', 'const user = await getCurrentUser()').blocked).toBe(false);
    expect(checkWrite('apps/web/src/actions/admission.ts', 'const { data: { user } } = await supabase.auth.getUser()').blocked).toBe(false);
    expect(checkWrite('apps/web/src/app/api/facility/beds/route.ts', 'await supabase.auth.getUser()').blocked).toBe(false);
    expect(checkWrite('apps/web/src/lib/supabase/current-user.ts', 'await supabase.auth.getUser()').blocked).toBe(false);
  });
});
