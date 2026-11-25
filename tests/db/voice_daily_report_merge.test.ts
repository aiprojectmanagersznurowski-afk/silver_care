import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (
  !['127.0.0.1', 'localhost'].includes(database.hostname) ||
  database.port !== '54322' ||
  database.username !== 'postgres' ||
  database.pathname !== '/postgres'
) {
  throw new Error('Local database required')
}

const sql = postgres(database.toString(), { prepare: false })
const rollback = Symbol('rollback')
const AI_DISCLOSURE = 'Podsumowanie generowane przy wsparciu AI, zatwierdzone przez personel placówki'

afterAll(() => sql.end())

async function createProjectedGeneralSegment(
  tx: postgres.TransactionSql,
  params: { org: string; author: string; resident: string; recordedAt: string; behavioralFacts: string[] }
) {
  const capture = randomUUID()
  const segment = randomUUID()
  await tx`INSERT INTO public.voice_captures
    (id, organization_id, source, source_key, storage_path, sha256, author_id, recorded_at, status)
    VALUES (${capture}, ${params.org}, 'APP_GENERAL', ${capture}, ${params.org + '/fixture/' + capture}, ${'b'.repeat(64)}, ${params.author}, ${params.recordedAt}, 'SEGMENTED')`
  await tx`INSERT INTO public.voice_segments
    (id, organization_id, capture_id, ordinal, start_ms, end_ms, transcript_path, assignment_status, author_id, author_attribution, resident_id)
    VALUES (${segment}, ${params.org}, ${capture}, 0, 0, 1000, ${params.org + '/fixture/' + segment}, 'RESIDENT', ${params.author}, 'AUTHENTICATED_SESSION', ${params.resident})`

  await tx`SET LOCAL ROLE service_role`
  const [claimed] = await tx`SELECT public.claim_voice_segment_projection(${segment}) AS result`
  const payload = tx.json({
    behavioral_facts: params.behavioralFacts,
    operational_facts: [],
    category_codes: [],
    restricted_medical: [],
    proposed_tasks: [],
  })
  await tx`SELECT public.complete_voice_segment_projection(${segment}, ${claimed.result.token}, ${payload}::jsonb)`
  return segment
}

describe('Mergowanie raportów dobowych z notatki ogólnej i notatki podopiecznego', () => {
  it('łączy fakty z nagrania ogólnego i późniejszej notatki o podopiecznym w jeden szkic daily_reports @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    await sql.begin(async (tx) => {
      const org = randomUUID()
      const author = randomUUID()
      const resident = randomUUID()
      const nowIso = new Date().toISOString()

      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture merge general->resident')`
      await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
        VALUES (${author}, 'authenticated', 'authenticated',
          jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
      await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
        VALUES (${resident}, ${org}, 'Anna', 'Testowa')`

      const segment1 = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident,
        recordedAt: nowIso,
        behavioralFacts: ['Zjadła całe śniadanie.'],
      })
      const segment2 = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident,
        recordedAt: nowIso,
        behavioralFacts: ['Wieczorem rozmawiała z bliskimi.'],
      })

      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: author,
        role: 'authenticated',
        aal: 'aal2',
        session_id: randomUUID(),
        app_metadata: { role: 'nurse', organization_id: org },
      })}, true)`

      const [rev1] = await tx`SELECT public.review_voice_family_facts(${segment1}, true) AS report_id`
      expect(rev1.report_id).toBeTruthy()

      const [draft] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${author}, 'local-pending-storage', 'Po południu spacerowała po ogrodzie.')
        RETURNING id`

      const [appRes] = await tx`SELECT public.process_voice_draft_atomic(
        ${draft.id},
        ${resident},
        ${author},
        ${tx.json({ draft_id: draft.id, medical: null, medication_event: 'none' })},
        ${tx.json({
          draft_id: draft.id,
          text: `Po południu spacerowała po ogrodzie.\n\n${AI_DISCLOSURE}`,
          requires_staff_review: false,
        })}
      ) AS res`

      expect(appRes.res.report_id).toBe(rev1.report_id)

      const [rev2] = await tx`SELECT public.review_voice_family_facts(${segment2}, true) AS report_id`
      expect(rev2.report_id).toBe(rev1.report_id)

      const reports = await tx`SELECT id, status, content FROM public.daily_reports WHERE resident_id = ${resident}`
      expect(reports).toHaveLength(1)
      expect(reports[0].status).toBe('DRAFT')

      const text = String(reports[0].content.text)
      expect(text).toContain('Zjadła całe śniadanie.')
      expect(text).toContain('Po południu spacerowała po ogrodzie.')
      expect(text).toContain('Wieczorem rozmawiała z bliskimi.')
      expect(text.split(AI_DISCLOSURE).length - 1).toBe(1)

      throw rollback
    }).catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  })

  it('łączy wcześniejszą notatkę o podopiecznym, nagranie ogólne i kolejną notatkę o podopiecznym z zachowaniem ochrony ręcznej edycji @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    await sql.begin(async (tx) => {
      const org = randomUUID()
      const author = randomUUID()
      const resident = randomUUID()
      const nowIso = new Date().toISOString()

      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture merge resident->general')`
      await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
        VALUES (${author}, 'authenticated', 'authenticated',
          jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
      await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
        VALUES (${resident}, ${org}, 'Marek', 'Przykładowy')`

      const segment1 = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident,
        recordedAt: nowIso,
        behavioralFacts: ['W południe zjadł zupę pomidorową.'],
      })
      const segment2 = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident,
        recordedAt: nowIso,
        behavioralFacts: ['Brał udział w zajęciach muzycznych.'],
      })

      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: author,
        role: 'authenticated',
        aal: 'aal2',
        session_id: randomUUID(),
        app_metadata: { role: 'nurse', organization_id: org },
      })}, true)`

      const [draft1] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${author}, 'local-pending-storage', 'Rano wypił ciepłą herbatę.')
        RETURNING id`

      const [res1] = await tx`SELECT public.process_voice_draft_atomic(
        ${draft1.id},
        ${resident},
        ${author},
        ${tx.json({ draft_id: draft1.id, medical: null, medication_event: 'none' })},
        ${tx.json({
          draft_id: draft1.id,
          text: `Rano wypił ciepłą herbatę.\n\n${AI_DISCLOSURE}`,
          requires_staff_review: false,
        })}
      ) AS res`

      const [rev1] = await tx`SELECT public.review_voice_family_facts(${segment1}, true) AS report_id`
      expect(rev1.report_id).toBe(res1.res.report_id)

      const [draft2] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${author}, 'local-pending-storage', 'Popołudnie spędził na czytaniu.')
        RETURNING id`

      const [res2] = await tx`SELECT public.process_voice_draft_atomic(
        ${draft2.id},
        ${resident},
        ${author},
        ${tx.json({ draft_id: draft2.id, medical: null, medication_event: 'none' })},
        ${tx.json({
          draft_id: draft2.id,
          text: `Popołudnie spędził na czytaniu.\n\n${AI_DISCLOSURE}`,
          requires_staff_review: false,
        })}
      ) AS res`

      expect(res2.res.report_id).toBe(res1.res.report_id)

      const reports = await tx`SELECT id, status, content FROM public.daily_reports WHERE resident_id = ${resident}`
      expect(reports).toHaveLength(1)
      const mergedText = String(reports[0].content.text)
      expect(mergedText).toContain('Rano wypił ciepłą herbatę.')
      expect(mergedText).toContain('W południe zjadł zupę pomidorową.')
      expect(mergedText).toContain('Popołudnie spędził na czytaniu.')
      expect(mergedText.split(AI_DISCLOSURE).length - 1).toBe(1)

      // Ręczna edycja szkicu przez personel blokuje ciche nadpisanie przez review_voice_family_facts
      await tx`UPDATE public.daily_reports
        SET content = jsonb_build_object('text', 'Ręcznie zredagowany tekst raportu.')
        WHERE id = ${res1.res.report_id}`

      await tx`SAVEPOINT sp_manual_edit`
      let manualEditError: { message?: string } | null = null
      try {
        await tx`SELECT public.review_voice_family_facts(${segment2}, true)`
      } catch (err) {
        manualEditError = err as { message?: string }
        await tx`ROLLBACK TO SAVEPOINT sp_manual_edit`
      }
      expect(manualEditError?.message).toContain('VOICE_FAMILY_DRAFT_ALREADY_REVIEWED')

      throw rollback
    }).catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  })
})
