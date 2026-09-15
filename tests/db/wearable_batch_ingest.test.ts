import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

/**
 * @REQ: INT-INGEST-PRECONDITIONS
 * @REQ: INT-NORMALIZATION
 */
describe('Wearable Batch Buffer & Ingest Preconditions (@REQ: INT-INGEST-PRECONDITIONS, @REQ: INT-NORMALIZATION)', () => {
  let sql: postgres.Sql

  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', {
      prepare: false,
    })
  })

  afterAll(async () => {
    await sql.end()
  })

  it('successfully processes batch telemetry payload with normalization and deduplication for consented resident', async () => {
    await sql.begin(async (tx) => {
      const [org] = await tx`
        INSERT INTO public.organizations (name)
        VALUES ('Wearable Buffer Test Org ' || gen_random_uuid())
        RETURNING id;
      `
      const testOrgId = org.id

      const [res] = await tx`
        INSERT INTO public.residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${testOrgId}, 'Aktywny', 'Zgoda', 'hash1_' || gen_random_uuid())
        RETURNING id;
      `
      const activeResidentId = res.id

      await tx`
        INSERT INTO public.consent_ledger (organization_id, resident_id, purpose, granted_by)
        VALUES (${testOrgId}, ${activeResidentId}, 'wellness_data_ingest', 'resident_self');
      `

      const claims = JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000001',
        app_metadata: {
          role: 'org_admin',
          organization_id: testOrgId,
        },
      })

      const payloads = [
        { metric: 'heart_rate', raw_value: '72', dedup_id: 'batch_hr_1' },
        { metric: 'heart_rate', raw_value: '74', dedup_id: 'batch_hr_2' },
        { metric: 'sleep_duration', raw_value: 'PT8H30M', dedup_id: 'batch_sleep_1' },
        { metric: 'heart_rate', raw_value: '72', dedup_id: 'batch_hr_1' },
      ]

      await tx`SELECT set_config('request.jwt.claims', ${claims}, true);`
      const [result] = await tx`
        SELECT public.process_ingest_batch(
          ${testOrgId}::uuid,
          ${activeResidentId}::uuid,
          'polar',
          ${JSON.stringify(payloads)}::jsonb
        ) as res;
      `

      const resObj = result.res
      expect(resObj.success).toBe(true)
      expect(resObj.inserted).toBe(3)
      expect(resObj.duplicates_ignored).toBe(1)

      const [sleepRow] = await tx`
        SELECT * FROM public.physiological_data_ingest 
        WHERE deduplication_id = 'batch_sleep_1';
      `
      expect(Number(sleepRow.value)).toBe(510)

      throw new Error('ROLLBACK')
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e
    })
  })

  it('rejects batch ingest and logs audit entry when resident has no active consent', async () => {
    await sql.begin(async (tx) => {
      const [org] = await tx`
        INSERT INTO public.organizations (name)
        VALUES ('Wearable Buffer Test Org 2 ' || gen_random_uuid())
        RETURNING id;
      `
      const testOrgId = org.id

      const [res] = await tx`
        INSERT INTO public.residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${testOrgId}, 'Brak', 'Zgody', 'hash2_' || gen_random_uuid())
        RETURNING id;
      `
      const noConsentResidentId = res.id

      const claims = JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000001',
        app_metadata: {
          role: 'org_admin',
          organization_id: testOrgId,
        },
      })

      const payloads = [
        { metric: 'heart_rate', raw_value: '80', dedup_id: 'unauthorized_hr_1' },
      ]

      await tx`SELECT set_config('request.jwt.claims', ${claims}, true);`
      const [result] = await tx`
        SELECT public.process_ingest_batch(
          ${testOrgId}::uuid,
          ${noConsentResidentId}::uuid,
          'garmin',
          ${JSON.stringify(payloads)}::jsonb
        ) as res;
      `

      expect(result.res.success).toBe(false)
      expect(result.res.reason).toBe('No active consent')

      const auditLogs = await tx`
        SELECT * FROM public.audit_logs 
        WHERE organization_id = ${testOrgId} AND resident_id = ${noConsentResidentId};
      `
      expect(auditLogs.length).toBe(1)
      expect(auditLogs[0].action).toBe('INGEST_REJECTED')

      throw new Error('ROLLBACK')
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e
    })
  })

  it('rejects batch ingest when resident is archived', async () => {
    await sql.begin(async (tx) => {
      const [org] = await tx`
        INSERT INTO public.organizations (name)
        VALUES ('Wearable Buffer Test Org 3 ' || gen_random_uuid())
        RETURNING id;
      `
      const testOrgId = org.id

      const [res] = await tx`
        INSERT INTO public.residents (organization_id, first_name, last_name, pesel_hash, archived_at)
        VALUES (${testOrgId}, 'Archiwalny', 'Pensjonariusz', 'hash3_' || gen_random_uuid(), now())
        RETURNING id;
      `
      const archivedResidentId = res.id

      const claims = JSON.stringify({
        sub: '00000000-0000-0000-0000-000000000001',
        app_metadata: {
          role: 'org_admin',
          organization_id: testOrgId,
        },
      })

      const payloads = [
        { metric: 'heart_rate', raw_value: '65', dedup_id: 'archived_hr_1' },
      ]

      await tx`SELECT set_config('request.jwt.claims', ${claims}, true);`
      const [result] = await tx`
        SELECT public.process_ingest_batch(
          ${testOrgId}::uuid,
          ${archivedResidentId}::uuid,
          'polar',
          ${JSON.stringify(payloads)}::jsonb
        ) as res;
      `

      expect(result.res.success).toBe(false)
      expect(result.res.reason).toBe('Resident archived')

      throw new Error('ROLLBACK')
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e
    })
  })
})
