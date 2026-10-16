import { describe, it, expect, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import * as nationalIdModule from '../../apps/web/src/lib/national-id-hash'

const ROOT = join(__dirname, '../..')
const PESEL = '85040112345'
const PESEL_2 = '92081598765'

describe('National ID hashing uses one secret salt (SEC-PESEL-HASH)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refuses to hash when PESEL_HASH_SALT is not configured @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', '')
    expect(() => nationalIdModule.hashNationalId(PESEL)).toThrow(/PESEL_HASH_SALT/)
  })

  it('hashes with HMAC-SHA256 keyed by the environment salt, deterministically @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-A')
    const expected = createHmac('sha256', 'salt-from-env-A').update(PESEL).digest('hex')
    expect(nationalIdModule.hashNationalId(PESEL)).toBe(expected)
    expect(nationalIdModule.hashNationalId(PESEL)).toBe(nationalIdModule.hashNationalId(PESEL))
    expect(nationalIdModule.hashNationalId(PESEL)).toHaveLength(64)
  })

  it('produces a different hash for a different salt, never the legacy hardcoded one @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-A')
    const a = nationalIdModule.hashNationalId(PESEL)
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-B')
    expect(nationalIdModule.hashNationalId(PESEL)).not.toBe(a)
    const legacy = createHmac('sha256', 'silvercare_pesel_salt').update(PESEL).digest('hex')
    expect(nationalIdModule.hashNationalId(PESEL)).not.toBe(legacy)
  })

  it('generates distinct hashes for distinct national IDs (collision resistance) @REQ: SEC-PESEL-HASH', () => {
    vi.stubEnv('PESEL_HASH_SALT', 'salt-from-env-test')
    const hash1 = nationalIdModule.hashNationalId(PESEL)
    const hash2 = nationalIdModule.hashNationalId(PESEL_2)
    expect(hash1).not.toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(hash2).toHaveLength(64)
  })
})

describe('No reversible national ID in application code (SEC-PESEL-HASH)', () => {
  it('does not export any reversible encryption functions or crypto keys @REQ: SEC-PESEL-HASH', () => {
    expect(nationalIdModule.hashNationalId).toBeDefined()
    expect((nationalIdModule as Record<string, unknown>).encryptNationalId).toBeUndefined()
    expect((nationalIdModule as Record<string, unknown>).decryptNationalId).toBeUndefined()
    expect(existsSync(join(ROOT, 'apps/web/src/lib/identity_crypto.ts'))).toBe(false)
  })
})

describe('Migration removes the reversible column (SEC-PESEL-HASH)', () => {
  it('drops residents.pesel_encrypted in a migration @REQ: SEC-PESEL-HASH', () => {
    const migrationPath = join(ROOT, 'supabase/migrations/20260930100000_remove_pesel_encrypted.sql')
    expect(existsSync(migrationPath)).toBe(true)
  })
})
