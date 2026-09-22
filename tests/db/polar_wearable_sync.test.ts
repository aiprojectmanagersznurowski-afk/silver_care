import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

/**
 * @REQ: INT-CORE-DECOUPLED
 * @REQ: INT-INGEST-PRECONDITIONS
 * @REQ: INT-NORMALIZATION
 */
describe('Polar Wearable Integration DB & Ingest Batch Flow', () => {
  let sql: postgres.Sql

  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', {
      prepare: false,
    })
  })

  afterAll(async () => {
    await sql.end()
  })

  it('verifies residents table has NO polar columns and external_wearable_links stores link @REQ: INT-CORE-DECOUPLED', async () => {
    await sql.begin(async (tx) => {
      // 1. Sprawdź schemat tabeli residents pod kątem braku kolumn dostawcy
      const columns = await tx`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'residents';
      `
      const colNames = columns.map((c) => c.column_name.toLowerCase())
      expect(colNames).not.toContain('polar_user_id')
      expect(colNames).not.toContain('polar_id')
      expect(colNames).not.toContain('provider_user_id')

      // 2. Utwórz organizację i pensjonariusza
      const [org] = await tx`
        INSERT INTO public.organizations (name)
        VALUES ('Polar Test Care Home ' || gen_random_uuid())
        RETURNING id;
      `
      const [res] = await tx`
        INSERT INTO public.residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Jan', 'PolarTest', 'hash_' || gen_random_uuid())
        RETURNING id;
      `

      const uniqueExternalUserId = 'polar_user_' + Math.random().toString(36).substring(2)

      // 3. Utwórz powiązanie w external_wearable_links
      const [link] = await tx`
        INSERT INTO public.external_wearable_links (organization_id, resident_id, provider, external_user_id)
        VALUES (${org.id}, ${res.id}, 'POLAR', ${uniqueExternalUserId})
        RETURNING *;
      `

      expect(link).toBeDefined()
      expect(link.provider).toBe('POLAR')
      expect(link.external_user_id).toBe(uniqueExternalUserId)
      expect(link.resident_id).toBe(res.id)

      throw new Error('ROLLBACK')
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e
    })
  })

  it('rejects ingest batch when consent is missing and accepts when consent is active @REQ: INT-INGEST-PRECONDITIONS @REQ: INT-NORMALIZATION', async () => {
    await sql.begin(async (tx) => {
      const [org] = await tx`
        INSERT INTO public.organizations (name)
        VALUES ('Polar Batch Org ' || gen_random_uuid())
        RETURNING id;
      `
      const [res] = await tx`
        INSERT INTO public.residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Anna', 'PolarTest', 'hash_' || gen_random_uuid())
        RETURNING id;
      `

      const claims = JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000001',
        app_metadata: {
          role: 'org_admin',
          organization_id: org.id,
        },
      })

      await tx`SELECT set_config('request.jwt.claims', ${claims}, true);`

      const testNonce = Math.random().toString(36).substring(2)
      const payload = JSON.stringify([
        { metric: 'steps_total', raw_value: '4500', dedup_id: `POLAR:${testNonce}:steps_total` }
      ])

      // 1. Ingest bez zgody — powinien zostać odrzucony
      const [rejectedResult] = await tx`
        SELECT public.process_ingest_batch(
          ${org.id}::uuid,
          ${res.id}::uuid,
          'POLAR',
          ${payload}::jsonb
        ) as res;
      `

      expect(rejectedResult.res.success).toBe(false)
      expect(rejectedResult.res.reason).toBe('No active consent')

      // 2. Dodaj zgodę do consent_ledger
      await tx`
        INSERT INTO public.consent_ledger (organization_id, resident_id, purpose, granted_by)
        VALUES (${org.id}, ${res.id}, 'wellness_data_ingest', 'resident_self');
      `

      // 3. Ingest ze zgodą — powinien zostać zaakceptowany
      const [acceptedResult] = await tx`
        SELECT public.process_ingest_batch(
          ${org.id}::uuid,
          ${res.id}::uuid,
          'POLAR',
          ${payload}::jsonb
        ) as res;
      `

      expect(acceptedResult.res.success).toBe(true)
      expect(acceptedResult.res.inserted).toBe(1)

      // 4. Re-ingest tej samej paczki — deduplikacja ON CONFLICT DO NOTHING
      const [dedupResult] = await tx`
        SELECT public.process_ingest_batch(
          ${org.id}::uuid,
          ${res.id}::uuid,
          'POLAR',
          ${payload}::jsonb
        ) as res;
      `

      expect(dedupResult.res.success).toBe(true)
      expect(dedupResult.res.inserted).toBe(0)
      expect(dedupResult.res.duplicates_ignored).toBe(1)

      throw new Error('ROLLBACK')
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e
    })
  })
})
