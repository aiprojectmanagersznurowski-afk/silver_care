#!/usr/bin/env node
/**
 * tools/sc-clean-db.mjs
 * 
 * Skrypt do bezpiecznego czyszczenia bazy danych i usuwania kont testowych w Silver Care.
 * 
 * ZASADA BEZPIECZEŃSTWA (accidental-data-loss-prevention):
 * - Domyślny tryb: --dry-run (tylko inspekcja i raportowanie).
 * - Twarda biała lista chronionych kont:
 *   - dariusz.rink@gmail.com
 *   - ai.projectmanager.sznurowski@gmail.com
 * - Do fizycznego usunięcia wymagana jest flaga --execute.
 * 
 * Flagi:
 *   --dry-run             (domyślnie) Podgląd danych do usunięcia bez wykonywania zmian
 *   --execute             Wymagane do wykonania fizycznego usunięcia
 *   --clean-users         Usunięcie użytkowników z auth.users poza białą listą (domyślnie włączone z --execute)
 *   --clean-domain        Wyczyszczenie danych domenowych w schemacie public (pensjonariusze, raporty, logi itp.)
 *   --all                 Wyczyszczenie zarówno użytkowników testowych, jak i danych domenowych
 *   --keep-primary-org    Zachowuje 'Główna Placówka Opiekuńcza' (domyślnie true, aby konto Michała miało poprawną placówkę)
 *   --wipe-all-orgs       Usuwa również wszystkie organizacje
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createRequire } from 'module';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { createClient } = require('../apps/web/node_modules/@supabase/supabase-js');

// 1. Biała lista nienaruszalnych kont
const PRESERVED_SUPER_ADMIN_EMAILS = [
  'dariusz.rink@gmail.com',
  'ai.projectmanager.sznurowski@gmail.com'
].map(e => e.toLowerCase().trim());

const PRIMARY_ORG_ID = 'eaf1bc9d-0745-42a7-bf5c-92c657d0fc8b'; // Główna Placówka Opiekuńcza

// 2. Weryfikacja zmiennych środowiskowych
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ BŁĄD: Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local');
  process.exit(1);
}

if (!dbUrl) {
  console.error('❌ BŁĄD: Brak DATABASE_URL w .env.local');
  process.exit(1);
}

// 3. Parsowanie flag CLI
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const isDryRun = !isExecute || args.includes('--dry-run');
const cleanAll = args.includes('--all');
const cleanUsers = cleanAll || args.includes('--clean-users') || (!args.includes('--clean-domain') && isExecute);
const cleanDomain = cleanAll || args.includes('--clean-domain');
const wipeAllOrgs = args.includes('--wipe-all-orgs');
const keepPrimaryOrg = !wipeAllOrgs;

// 4. Inicjalizacja klientów
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const sql = postgres(dbUrl, { prepare: false });

// 5. Lista tabel domenowych do wyczyszczenia (w kolejności kaskady lub TRUNCATE)
const DOMAIN_TABLES = [
  'agenda_items',
  'audit_logs',
  'bed_assignments',
  'beds',
  'consent_ledger',
  'daily_logs',
  'daily_reports',
  'external_wearable_links',
  'family_messages',
  'outbox_notifications',
  'physiological_data_ingest',
  'polar_oauth_tokens',
  'report_feedback',
  'resident_care_level_history',
  'resident_events',
  'resident_invitations',
  'resident_media',
  'resident_packages',
  'resident_relative_links',
  'residents',
  'rooms',
  'security_access_logs',
  'voice_draft_notes'
];

async function main() {
  console.log('='.repeat(70));
  console.log('🛡️  SILVER CARE — BEZPIECZNE CZYSZCZENIE BAZY DANYCH');
  console.log(`Tryb działania: ${isExecute ? '🔴 FIZYCZNE WYKONANIE (--execute)' : '🟢 PODGLĄD BEZPIECZNY (--dry-run)'}`);
  console.log('='.repeat(70));

  // Krok A: Pobranie wszystkich użytkowników z Supabase Auth
  const { data: { users }, error: listUsersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listUsersError) {
    console.error('❌ Błąd podczas pobierania listy użytkowników z Auth:', listUsersError);
    await sql.end();
    process.exit(1);
  }

  // Krok B: Sprawdzenie obecności chronionych kont
  const preservedUsers = [];
  const usersToDelete = [];

  for (const user of users) {
    const userEmail = (user.email || '').toLowerCase().trim();
    if (PRESERVED_SUPER_ADMIN_EMAILS.includes(userEmail)) {
      preservedUsers.push(user);
    } else {
      usersToDelete.push(user);
    }
  }

  console.log('\n👑 CHRONIENI SUPER ADMINISTRATORZY (pozostają w bazie):');
  for (const p of preservedUsers) {
    console.log(`  ✓ [${p.id}] ${p.email} (rola: ${p.app_metadata?.role || p.user_metadata?.role || 'brak'})`);
  }

  // Weryfikacja integralności: czy oba konta zostały odnalezione?
  const missingPreserved = PRESERVED_SUPER_ADMIN_EMAILS.filter(
    email => !preservedUsers.some(u => (u.email || '').toLowerCase().trim() === email)
  );

  if (missingPreserved.length > 0) {
    console.error(`\n❌ KRYTYCZNY BŁĄD INTEGRALNOŚCI:`);
    console.error(`Nie znaleziono w bazie następujących kont z białej listy: ${missingPreserved.join(', ')}`);
    console.error(`Przerywam działanie w celu ochrony bazy danych.`);
    await sql.end();
    process.exit(1);
  }

  console.log(`\n📋 UŻYTKOWNICY DO USUNIĘCIA Z AUTH (${usersToDelete.length} kont):`);
  for (const u of usersToDelete) {
    const role = u.app_metadata?.role || u.user_metadata?.role || 'brak roli';
    const org = u.app_metadata?.organization_id || u.user_metadata?.organization_id || 'brak org';
    console.log(`  ✗ [${u.id}] ${u.email.padEnd(35)} (rola: ${role.padEnd(12)}, org: ${org})`);
  }

  // Krok C: Raport z tabel domenowych (schemat public)
  console.log('\n📊 STAN TABEL DOMENOWYCH (schemat public):');
  const tableCounts = {};
  for (const table of DOMAIN_TABLES) {
    try {
      const [res] = await sql.unsafe(`SELECT COUNT(*) as count FROM public.${table}`);
      tableCounts[table] = parseInt(res.count, 10);
      console.log(`  • ${table.padEnd(30)}: ${res.count} wierszy`);
    } catch (e) {
      console.log(`  • ${table.padEnd(30)}: [brak tabeli lub błąd: ${e.message}]`);
    }
  }

  // Sprawdzenie organizacji
  const orgs = await sql`SELECT id, name FROM public.organizations`;
  console.log(`\n🏢 ORGANIZACJE (${orgs.length} placówek):`);
  for (const org of orgs) {
    const isPrimary = org.id === PRIMARY_ORG_ID;
    const action = keepPrimaryOrg && isPrimary ? 'ZACHOWAJ (Główna Placówka)' : 'DO USUNIĘCIA';
    console.log(`  ${isPrimary ? '✓' : '✗'} [${org.id}] ${org.name.padEnd(45)} -> ${action}`);
  }

  // Krok D: Jeśli DRY-RUN — zatrzymujemy się z instrukcją
  if (isDryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('ℹ️  PODSUMOWANIE TRYBU DRY-RUN:');
    console.log(`  - Konta do usunięcia z Auth:  ${usersToDelete.length}`);
    console.log(`  - Konta do zachowania w Auth: 2 (${PRESERVED_SUPER_ADMIN_EMAILS.join(', ')})`);
    console.log(`  - Tabele domenowe:            ${DOMAIN_TABLES.length} tabel do wyczyszczenia`);
    console.log(`  - Organizacje:                ${wipeAllOrgs ? 'wszystkie do usunięcia' : 'zachowana tylko Główna Placówka'}`);
    console.log('\n⚠️  ŻADNE DANE NIE ZOSTAŁY ZMIENIONE.');
    console.log('\nAby wykonać operację czyszczenia:');
    console.log('  1. Tylko konta użytkowników:');
    console.log('     node tools/sc-clean-db.mjs --execute --clean-users');
    console.log('  2. Konta użytkowników + dane domenowe (polecane):');
    console.log('     node tools/sc-clean-db.mjs --execute --all');
    console.log('  3. Wyczyszczenie absolutnie wszystkiego (wraz ze wszystkimi organizacjami):');
    console.log('     node tools/sc-clean-db.mjs --execute --all --wipe-all-orgs');
    console.log('='.repeat(70));
    await sql.end();
    return;
  }

  // Krok E: FIZYCZNE WYKONANIE (--execute)
  console.log('\n🚀 ROZPOCZYNAM FIZYCZNE WYKONYWANIE OPERACJI...');

  // 1. Usuwanie użytkowników z Auth
  if (cleanUsers) {
    console.log(`\n1️⃣ Usuwanie ${usersToDelete.length} użytkowników z Supabase Auth...`);
    let deletedCount = 0;
    let failedCount = 0;

    for (const u of usersToDelete) {
      try {
        const { error: delError } = await supabase.auth.admin.deleteUser(u.id);
        if (delError) {
          console.error(`  ❌ Błąd usuwania ${u.email} (${u.id}):`, delError.message);
          failedCount++;
        } else {
          console.log(`  ✓ Usunięto konto Auth: ${u.email} (${u.id})`);
          deletedCount++;
        }
      } catch (err) {
        console.error(`  ❌ Wyjątek przy usuwaniu ${u.email}:`, err.message);
        failedCount++;
      }
    }
    console.log(`✅ Zakończono usuwanie kont: ${deletedCount} usunięto, ${failedCount} błędów.`);
  }

  // 2. Czyszczenie tabel domenowych
  if (cleanDomain) {
    console.log('\n2️⃣ Czyszczenie danych domenowych w schemacie public...');
    try {
      // Używamy TRUNCATE z CASCADE dla atomowego i błyskawicznego wyczyszczenia
      const tablesSql = DOMAIN_TABLES.map(t => `public."${t}"`).join(', ');
      await sql.unsafe(`TRUNCATE TABLE ${tablesSql} CASCADE;`);
      console.log('  ✓ Wyczyszczono tabele domenowe (pensjonariusze, raporty, logi, pokoje, łóżka itp.).');
    } catch (e) {
      console.error('  ❌ Błąd podczas TRUNCATE tabel domenowych:', e.message);
      console.log('  Próbuję usuwać po kolei za pomocą DELETE...');
      for (const t of [...DOMAIN_TABLES].reverse()) {
        try {
          await sql.unsafe(`DELETE FROM public."${t}"`);
          console.log(`  ✓ DELETE FROM public.${t}`);
        } catch (delErr) {
          console.warn(`  ⚠️ Nie udało się usunąć z ${t}: ${delErr.message}`);
        }
      }
    }

    // 3. Obsługa tabeli organizations
    if (wipeAllOrgs) {
      console.log('\n3️⃣ Usuwanie wszystkich organizacji...');
      await sql`DELETE FROM public.organizations`;
      console.log('  ✓ Usunięto wszystkie organizacje.');
      
      console.log('  Aktualizacja kont Super Adminów (usunięcie powiązania ze starymi placówkami)...');
      for (const p of preservedUsers) {
        await supabase.auth.admin.updateUserById(p.id, {
          app_metadata: {
            ...(p.app_metadata || {}),
            organization_id: null,
            role: 'super_admin'
          }
        });
        console.log(`  ✓ Zaktualizowano ${p.email}: rola=super_admin, organization_id=null`);
      }
    } else if (keepPrimaryOrg) {
      console.log(`\n3️⃣ Usuwanie organizacji testowych poza Główną Placówką (${PRIMARY_ORG_ID})...`);
      const delOrgs = await sql`
        DELETE FROM public.organizations 
        WHERE id != ${PRIMARY_ORG_ID}
        RETURNING id, name
      `;
      console.log(`  ✓ Usunięto ${delOrgs.length} organizacji testowych.`);
      for (const o of delOrgs) {
        console.log(`    - Usunięto: ${o.name} (${o.id})`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎉 CZYSZCZENIE ZAKOŃCZONE SUKCESEM!');
  console.log('Pozostałe konta w systemie:');
  for (const p of preservedUsers) {
    console.log(`  👑 ${p.email} [${p.id}]`);
  }
  console.log('='.repeat(70));

  await sql.end();
}

main().catch(async (err) => {
  console.error('\n❌ NIEOCZEKIWANY BŁĄD KRYTYCZNY:', err);
  await sql.end();
  process.exit(1);
});
