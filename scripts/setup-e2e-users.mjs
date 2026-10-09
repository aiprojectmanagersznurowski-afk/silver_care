#!/usr/bin/env node
/**
 * setup-e2e-users.mjs — Idempotentne przygotowanie kont testowych dla testów E2E.
 *
 * Tworzy lub aktualizuje konta dla 4 ról:
 * - super_admin (Operator platformy)
 * - org_admin (Administrator placówki)
 * - nurse (Pielęgniarka / Pielęgniarz)
 * - family (Członek rodziny z powiązaniem do pensjonariusza)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(rootDir, '.env.local') });

// Załaduj supabase-js z apps/web
const require = createRequire(import.meta.url);
const { createClient } = require(path.resolve(rootDir, 'apps/web/node_modules/@supabase/supabase-js'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceKey || !dbUrl) {
  console.error('Brak wymaganych zmiennych SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY lub DATABASE_URL.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const sql = postgres(dbUrl, { prepare: false });

export const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'SilverTest123!';

export async function setupE2EUsers() {
  console.log('🔄 Przygotowywanie kont testowych E2E...');
  const orgs = await sql`SELECT id FROM public.organizations LIMIT 1`;
  const mainOrgId = orgs.length > 0 ? orgs[0].id : '9d9b1de9-8f38-48c8-8b5b-721901fed8ff';

  const testUsers = {
    super_admin: {
      email: 'e2e.superadmin@silvercare.test',
      role: 'super_admin',
      organization_id: mainOrgId,
    },
    org_admin: {
      email: 'e2e.admin@silvercare.test',
      role: 'org_admin',
      organization_id: mainOrgId,
    },
    nurse: {
      email: 'e2e.nurse@silvercare.test',
      role: 'nurse',
      organization_id: mainOrgId,
    },
    family: {
      email: 'e2e.family@silvercare.test',
      role: 'family',
      organization_id: mainOrgId,
    },
  };
  const { data: existingUsersData, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (listErr) throw listErr;

  const existingMap = new Map((existingUsersData.users || []).map((u) => [u.email?.toLowerCase(), u]));
  const createdIds = {};

  for (const [key, config] of Object.entries(testUsers)) {
    const existing = existingMap.get(config.email.toLowerCase());
    if (existing) {
      // Aktualizuj hasło i metadane roli
      await supabase.auth.admin.updateUserById(existing.id, {
        password: E2E_PASSWORD,
        app_metadata: {
          role: config.role,
          organization_id: config.organization_id,
        },
      });
      createdIds[key] = existing.id;
      console.log(`  ✓ Zaktualizowano konto ${config.role} (${config.email})`);
    } else {
      // Utwórz nowe konto
      const { data, error } = await supabase.auth.admin.createUser({
        email: config.email,
        password: E2E_PASSWORD,
        email_confirm: true,
        app_metadata: {
          role: config.role,
          organization_id: config.organization_id,
        },
      });
      if (error) throw error;
      createdIds[key] = data.user.id;
      console.log(`  ✓ Utworzono konto ${config.role} (${config.email})`);
    }
  }

  // Upewnij się, że użytkownik family ma aktywne powiązanie z pensjonariuszem
  const familyUserId = createdIds.family;
  if (familyUserId) {
    const residents = await sql`
      SELECT id FROM residents 
      WHERE organization_id = ${mainOrgId} AND archived_at IS NULL 
      LIMIT 1
    `;

    if (residents.length > 0) {
      const residentId = residents[0].id;
      const existingLink = await sql`
        SELECT id FROM resident_relative_links 
        WHERE relative_user_id = ${familyUserId} AND resident_id = ${residentId}
      `;

      if (existingLink.length === 0) {
        await sql`
          INSERT INTO resident_relative_links (
            resident_id,
            relative_user_id,
            relationship_code,
            role
          ) VALUES (
            ${residentId},
            ${familyUserId},
            'family',
            'family'
          )
        `;
        console.log(`  ✓ Powiązano konto rodziny z pensjonariuszem ${residentId}`);
      } else {
        console.log(`  ✓ Konto rodziny posiada już aktywne powiązanie z pensjonariuszem`);
      }
    }
  }

  await sql.end();
  console.log('✅ Wszystkie konta testowe E2E są gotowe.');
}

// Uruchom bezpośrednio, jeśli wywołano z CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupE2EUsers().catch((err) => {
    console.error('❌ Błąd konfiguracji kont E2E:', err);
    process.exit(1);
  });
}
