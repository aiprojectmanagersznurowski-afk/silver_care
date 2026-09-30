import { describe, it, expect, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { hashNationalId } from '../../apps/web/src/lib/national-id-hash'

const ROOT = join(__dirname, '../..')
const PESEL = '85040112345'

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.next'].includes(entry)) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(p)
  }
  return out
}

describe('National ID hashing uses one secret salt (SEC-PESEL-HASH)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses to hash when PESEL_HASH_SALT is not configured @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', '')
    expect(() => hashNationalId(PESEL)).toThrow(/PESEL_HASH_SALT/)
  })

  it('hashes with HMAC-SHA256 keyed by the environment salt, deterministically @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-A')
    const expected = createHmac('sha256', 'salt-from-env-A').update(PESEL).digest('hex')
    expect(hashNationalId(PESEL)).toBe(expected)
    expect(hashNationalId(PESEL)).toBe(hashNationalId(PESEL))
  })

  it('produces a different hash for a different salt, never the legacy hardcoded one @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-A')
    const a = hashNationalId(PESEL)
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-B')
    expect(hashNationalId(PESEL)).not.toBe(a)
    const legacy = createHmac('sha256', 'silvercare_pesel_salt').update(PESEL).digest('hex')
    expect(hashNationalId(PESEL)).not.toBe(legacy)
  })
})

describe('No reversible national ID in application code (SEC-PESEL-HASH)', () => {
  const sources = walk(join(ROOT, 'apps/web/src')).map((f) => ({
    file: f.replace(ROOT + '/', ''),
    text: readFileSync(f, 'utf8'),
  }))

  it('has no hardcoded hash salt anywhere in the application @REQ: SEC-PESEL-HASH', () => {
    const offenders = sources.filter((s) => s.text.includes('silvercare_pesel_salt')).map((s) => s.file)
    expect(offenders).toEqual([])
  })

  it('does not reference the reversible pesel_encrypted column or its crypto @REQ: SEC-PESEL-HASH', () => {
    const offenders = sources
      .filter((s) => /pesel_encrypted|encryptNationalId|decryptNationalId|IDENTITY_ENCRYPTION_KEY/.test(s.text))
      .map((s) => s.file)
    expect(offenders).toEqual([])
    expect(existsSync(join(ROOT, 'apps/web/src/lib/identity_crypto.ts'))).toBe(false)
  })
})

describe('Migration removes the reversible column (SEC-PESEL-HASH)', () => {
  const dir = join(ROOT, 'supabase/migrations')
  const drop = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }))
    .find((m) => /DROP COLUMN[^;]*pesel_encrypted/i.test(m.text))

  it('drops residents.pesel_encrypted in a migration @REQ: SEC-PESEL-HASH', () => {
    expect(drop).toBeDefined()
  })

  it('recreates admit_resident_with_bed without the encrypted parameter, dropping the old signature first @REQ: SEC-PESEL-HASH', () => {
    expect(drop?.text).toMatch(/DROP FUNCTION[^;]*admit_resident_with_bed/i)
    // Tylko definicja funkcji — końcowy ALTER TABLE ... DROP COLUMN wymienia kolumnę z definicji.
    const create = (drop?.text.split(/CREATE OR REPLACE FUNCTION public\.admit_resident_with_bed/i)[1] ?? '')
      .split(/ALTER TABLE/i)[0]
    expect(create.length).toBeGreaterThan(0)
    expect(create).not.toMatch(/pesel_encrypted/i)
  })
})
