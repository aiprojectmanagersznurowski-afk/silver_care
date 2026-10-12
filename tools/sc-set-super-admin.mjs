#!/usr/bin/env node
/**
 * tools/sc-set-super-admin.mjs
 * 
 * Bezpieczne narzędzie CLI do nadawania uprawnień roli super_admin wskazanemu użytkownikowi.
 * 
 * Dlaczego w CLI, a nie w webowym IAM?
 * - Ze względów bezpieczeństwa (wymogi SUP-IAM-PANEL, SEC-IAM-HARDENING oraz AC3),
 *   nadawanie roli super_admin jest celowo zablokowane w interfejsie www oraz w Server Actions.
 * - Rola super_admin ma charakter root/platformowy i może być nadawana wyłącznie
 *   z poziomu infrastruktury (klucz service_role lub panel Supabase).
 * 
 * Użycie:
 *   node tools/sc-set-super-admin.mjs <adres-email>
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createClient } = require('../apps/web/node_modules/@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ BŁĄD: Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local');
  process.exit(1);
}

const targetEmail = process.argv[2]?.trim().toLowerCase();

if (!targetEmail) {
  console.log('Użycie: node tools/sc-set-super-admin.mjs <adres-email>');
  console.log('Przykład: node tools/sc-set-super-admin.mjs admin@twojadomena.pl');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log(`🔍 Wyszukiwanie użytkownika o adresie: ${targetEmail}...`);

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listErr) {
    console.error('❌ Błąd pobierania listy użytkowników:', listErr.message);
    process.exit(1);
  }

  const user = users.find(u => (u.email || '').toLowerCase().trim() === targetEmail);

  if (!user) {
    console.error(`❌ Nie znaleziono użytkownika o adresie ${targetEmail} w Supabase Auth.`);
    console.log('Użytkownik musi najpierw założyć konto / zarejestrować się w systemie.');
    process.exit(1);
  }

  const currentRole = user.app_metadata?.role || user.user_metadata?.role || 'brak roli';
  console.log(`Znaleziono konto: [${user.id}] ${user.email} (obecna rola: ${currentRole})`);

  if (currentRole === 'super_admin') {
    console.log('ℹ️  Użytkownik już posiada rolę super_admin.');
    return;
  }

  console.log(`⚡ Nadawanie uprawnień super_admin dla ${user.email}...`);

  const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      role: 'super_admin'
    }
  });

  if (updateErr) {
    console.error('❌ Błąd podczas aktualizacji roli:', updateErr.message);
    process.exit(1);
  }

  console.log('✅ SUKCES! Pomyślnie nadano rolę super_admin.');
  console.log(`Użytkownik: ${updated.user.email} [${updated.user.id}]`);
  console.log(`Nowa rola: ${updated.user.app_metadata?.role}`);
}

run().catch(err => {
  console.error('❌ Błąd krytyczny:', err);
  process.exit(1);
});
