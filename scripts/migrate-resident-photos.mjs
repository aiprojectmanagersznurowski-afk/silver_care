#!/usr/bin/env node
/**
 * Przeniesienie istniejących zdjęć podopiecznych z publicznego `avatars` do prywatnego `resident-photos`
 * (SC-ADM-25/AC5, WO-ADM-RESIDENT-PHOTO krok 5). Uruchamia człowiek.
 *
 * Domyślnie TYLKO RAPORT (nic nie zmienia):   node scripts/migrate-resident-photos.mjs
 * Wykonanie:                                    node scripts/migrate-resident-photos.mjs --apply
 *
 * Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL (albo SUPABASE_URL) i SUPABASE_SERVICE_ROLE_KEY.
 * Najpierw muszą być zastosowane migracje 20261117120000 (bucket, photo_path) i wdrożony kod, który pokazuje
 * zdjęcia z photo_path. Dla każdego podopiecznego: kopia do <placówka>/<podopieczny>/<uuid>.<ext>, zapis
 * photo_path, wyczyszczenie avatar_url, usunięcie publicznej kopii. W logu tylko liczby i kody błędów.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { planPhotoMove, summarizePlan } from './lib/resident-photo-migration.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.resolve(rootDir, '.env.local') });
// supabase-js jest zależnością apps/web (jak w scripts/setup-e2e-users.mjs)
const { createClient } = createRequire(import.meta.url)(path.resolve(rootDir, 'apps/web/node_modules/@supabase/supabase-js'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Brak NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w .env.local');
  process.exit(1);
}
const apply = process.argv.includes('--apply');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: rows, error } = await supabase.from('residents').select('id, organization_id, avatar_url, photo_path');
if (error) {
  console.error('Odczyt podopiecznych nieudany', { code: error.code });
  process.exit(1);
}

console.log(`Baza: ${new URL(url).host}`);
console.log('Plan:', summarizePlan(rows, randomUUID));
if (!apply) {
  console.log('Tryb raportu — nic nie zmieniono. Wykonanie: --apply');
  process.exit(0);
}

const result = { moved: 0, failed: 0 };
for (const r of rows) {
  const move = planPhotoMove(r, randomUUID);
  if (!move) continue;
  const step = async () => {
    const { data: blob, error: dlErr } = await supabase.storage.from('avatars').download(move.from);
    if (dlErr || !blob) return 'download';
    const { error: upErr } = await supabase.storage.from('resident-photos').upload(move.to, blob, { contentType: blob.type || 'image/webp', upsert: false });
    if (upErr) return 'upload';
    const { error: dbErr } = await supabase.from('residents').update({ photo_path: move.to, avatar_url: null }).eq('id', move.residentId);
    if (dbErr) {
      await supabase.storage.from('resident-photos').remove([move.to]);
      return 'update';
    }
    await supabase.storage.from('avatars').remove([move.from]);
    return null;
  };
  const failure = await step();
  if (failure) {
    result.failed++;
    console.error('Nieudane przeniesienie', { stage: failure });
  } else {
    result.moved++;
  }
}
console.log('Wynik:', result);
process.exit(result.failed ? 1 : 0);
