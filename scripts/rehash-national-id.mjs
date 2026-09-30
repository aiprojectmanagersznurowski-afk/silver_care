#!/usr/bin/env node
/**
 * Jednorazowe przeliczenie pesel_hash nową, sekretną solą (SEC-PESEL-HASH).
 *
 * Kiedy: PRZED zastosowaniem migracji 20260930100000_remove_pesel_encrypted.sql.
 * Po usunięciu kolumny pesel_encrypted numer źródłowy jest nie do odzyskania, a stare hashe
 * (liczone solą zapisaną w kodzie) zostałyby na zawsze słabe i niezgodne z nowym kodem.
 *
 * Wymagane zmienne (nie ma wartości domyślnych):
 *   DATABASE_URL                     — połączenie z bazą
 *   PESEL_HASH_SALT                  — nowa sekretna sól (ta sama, co na produkcji w aplikacji)
 *   OLD_IDENTITY_ENCRYPTION_KEY      — klucz, którym szyfrowano pesel_encrypted.
 *     Jeśli IDENTITY_ENCRYPTION_KEY nigdy nie był ustawiony na produkcji, działał klucz
 *     domyślny z historii git: apps/web/src/lib/identity_crypto.ts (commit 4e7be1d).
 *
 * Domyślnie DRY-RUN. Zapis wymaga --apply. Skrypt nie wypisuje numerów, tylko liczniki i UUID.
 *
 *   node scripts/rehash-national-id.mjs            # podgląd
 *   node scripts/rehash-national-id.mjs --apply    # zapis
 */
import crypto from 'node:crypto'
import postgres from 'postgres'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const APPLY = process.argv.includes('--apply')
const { DATABASE_URL, PESEL_HASH_SALT, OLD_IDENTITY_ENCRYPTION_KEY } = process.env
for (const [name, value] of Object.entries({ DATABASE_URL, PESEL_HASH_SALT, OLD_IDENTITY_ENCRYPTION_KEY })) {
  if (!value) throw new Error(`Brak wymaganej zmiennej ${name}.`)
}

const oldKey = crypto.createHash('sha256').update(OLD_IDENTITY_ENCRYPTION_KEY).digest()

function decrypt(payload) {
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('format')
  const decipher = crypto.createDecipheriv('aes-256-gcm', oldKey, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(dataHex, 'hex', 'utf8') + decipher.final('utf8')
}

const newHash = (value) => crypto.createHmac('sha256', PESEL_HASH_SALT).update(value).digest('hex')

const sql = postgres(DATABASE_URL, { prepare: false })

try {
  const rows = await sql`SELECT id, pesel_hash, pesel_encrypted FROM public.residents`
  let unchanged = 0
  let toUpdate = 0
  const noSource = []
  const failed = []

  await sql.begin(async (tx) => {
    for (const row of rows) {
      if (!row.pesel_encrypted) {
        noSource.push(row.id)
        continue
      }
      let plain
      try {
        plain = decrypt(row.pesel_encrypted)
      } catch {
        failed.push(row.id)
        continue
      }
      if (!/^\d{11}$/.test(plain)) {
        failed.push(row.id)
        continue
      }
      const hash = newHash(plain)
      if (hash === row.pesel_hash) {
        unchanged++
        continue
      }
      toUpdate++
      if (APPLY) await tx`UPDATE public.residents SET pesel_hash = ${hash} WHERE id = ${row.id}`
    }
    // Przy błędach nie zapisujemy nic: częściowe przeliczenie zostawiłoby dwie sole w jednej tabeli.
    if (APPLY && failed.length) throw new Error('Nie można odszyfrować części rekordów — wycofuję całość.')
  })

  console.log(`Rekordów: ${rows.length}`)
  console.log(`Już poprawny hash: ${unchanged}`)
  console.log(`${APPLY ? 'Przeliczono' : 'Do przeliczenia (dry-run)'}: ${toUpdate}`)
  console.log(`Bez źródła (pesel_encrypted puste, hash bez zmian): ${noSource.length}`)
  if (noSource.length) console.log('  id:', noSource.join(', '))
  console.log(`Nie do odszyfrowania: ${failed.length}`)
  if (failed.length) {
    console.log('  id:', failed.join(', '))
    process.exitCode = 1
  }
  if (!APPLY) console.log('\nDRY-RUN — nic nie zapisano. Dodaj --apply, aby zapisać.')
} finally {
  await sql.end()
}
