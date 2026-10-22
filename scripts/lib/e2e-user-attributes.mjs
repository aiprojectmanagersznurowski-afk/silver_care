/**
 * Atrybuty kont testowych E2E przekazywane do Supabase Admin API.
 *
 * Wydzielone ze scripts/setup-e2e-users.mjs, bo skrypt ma efekty uboczne przy imporcie
 * (połączenie z bazą, process.exit przy braku zmiennych), a te funkcje trzeba testować.
 */

/**
 * Aktualizacja istniejącego konta. `ban_duration: 'none'` zdejmuje blokadę: test
 * staff-account-actions.spec.ts zawiesza e2e.nurse i go nie przywraca, więc bez tego
 * każdy kolejny przebieg zaczynałby się od konta, które nie może się zalogować.
 */
export function buildExistingUserUpdate(password, config) {
  return {
    password,
    email_confirm: true,
    ban_duration: 'none',
    app_metadata: {
      role: config.role,
      // null usuwa stary claim: rola globalna (super_admin) nie należy do żadnej placówki
      organization_id: config.organization_id ?? null,
    },
  };
}

/** Utworzenie nowego konta (nowe konto nie ma blokady, więc bez ban_duration). */
export function buildNewUserCreate(password, config) {
  return {
    email: config.email,
    password,
    email_confirm: true,
    app_metadata: {
      role: config.role,
      ...(config.organization_id ? { organization_id: config.organization_id } : {}),
    },
  };
}

/**
 * Konta testowe E2E. super_admin to rola globalna (roles.contract: scope GLOBAL, „zarządza
 * placówkami, nie czyta treści opieki"), więc nie należy do żadnej placówki.
 */
export function buildTestUsers(mainOrgId) {
  return {
    super_admin: { email: 'e2e.superadmin@silvercare.test', role: 'super_admin' },
    org_admin: { email: 'e2e.admin@silvercare.test', role: 'org_admin', organization_id: mainOrgId },
    nurse: { email: 'e2e.nurse@silvercare.test', role: 'nurse', organization_id: mainOrgId },
    family: { email: 'e2e.family@silvercare.test', role: 'family', organization_id: mainOrgId },
  };
}
