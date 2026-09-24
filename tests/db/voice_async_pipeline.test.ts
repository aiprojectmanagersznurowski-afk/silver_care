import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

/**
 * @REQ: VOICE-ZERO-GUESSING
 * @REQ: VOICE-OFFLINE
 */
describe('Voice Async Pipeline & Queueing (@REQ: VOICE-ZERO-GUESSING @REQ: VOICE-OFFLINE)', () => {
  let sql: postgres.Sql
  const createdIds: string[] = []
  let testOrgId: string
  let testResidentId: string

  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', {
      prepare: false,
    })

    const [org] = await sql`
      INSERT INTO public.organizations (name)
      VALUES ('Voice Async Test Org ' || gen_random_uuid())
      RETURNING id;
    `
    testOrgId = org.id

    const [res] = await sql`
      INSERT INTO public.residents (organization_id, first_name, last_name, pesel_hash)
      VALUES (${testOrgId}, 'Głosowy', 'Podopieczny', 'hash_voc_' || gen_random_uuid())
      RETURNING id;
    `
    testResidentId = res.id
  })

  afterAll(async () => {
    if (testOrgId) {
      await sql`SELECT set_config('audit.allow_redact', 'true', false);`
      await sql`DELETE FROM public.voice_draft_notes WHERE resident_id = ${testResidentId};`
      await sql`DELETE FROM public.residents WHERE id = ${testResidentId};`
      await sql`DELETE FROM public.organizations WHERE id = ${testOrgId};`
      await sql`SELECT set_config('audit.allow_redact', 'false', false);`
    }
    await sql.end()
  })

  it('queues a voice note with QUEUED status and atomicity', async () => {
    const [draft] = await sql`
      INSERT INTO public.voice_draft_notes (
        resident_id,
        nurse_id,
        audio_url,
        status,
        async_status
      ) VALUES (
        ${testResidentId},
        gen_random_uuid(),
        'https://storage.local/test.webm',
        'DRAFT',
        'QUEUED'
      ) RETURNING id, async_status, attempts;
    `
    createdIds.push(draft.id)

    expect(draft.async_status).toBe('QUEUED')
    expect(draft.attempts).toBe(0)

    // Pobieramy zadanie przez funkcję kolejkową
    const [fetchedJob] = await sql`SELECT * FROM public.fetch_next_voice_job();`
    expect(fetchedJob).toBeDefined()
    expect(fetchedJob.id).toBe(draft.id)
    expect(fetchedJob.async_status).toBe('TRANSCRIBING')
    expect(fetchedJob.attempts).toBe(1)
  })

  it('enforces client_uuid idempotency for offline voice notes', async () => {
    const offlineUuid = '11111111-2222-3333-4444-555555555555'

    const [first] = await sql`
      INSERT INTO public.voice_draft_notes (
        resident_id,
        nurse_id,
        audio_url,
        client_uuid,
        status,
        async_status
      ) VALUES (
        ${testResidentId},
        gen_random_uuid(),
        'local-audio-first',
        ${offlineUuid},
        'DRAFT',
        'QUEUED'
      ) RETURNING id;
    `
    createdIds.push(first.id)

    // Druga próba wstawienia z tym samym client_uuid powinna zostać zablokowana przez unikalność
    await expect(
      sql`
        INSERT INTO public.voice_draft_notes (
          resident_id,
          nurse_id,
          audio_url,
          client_uuid,
          status,
          async_status
        ) VALUES (
          ${testResidentId},
          gen_random_uuid(),
          'local-audio-second',
          ${offlineUuid},
          'DRAFT',
          'QUEUED'
        );
      `
    ).rejects.toThrow()
  })
})
