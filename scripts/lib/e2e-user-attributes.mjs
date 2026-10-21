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
      organization_id: config.organization_id,
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
      organization_id: config.organization_id,
    },
  };
}
