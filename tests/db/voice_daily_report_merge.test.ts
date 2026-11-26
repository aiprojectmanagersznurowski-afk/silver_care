import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const database = new URL(process.env.DATABASE_URL!)
if (
  !['127.0.0.1', 'localhost'].includes(database.hostname) ||
  !database.port ||
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
  tx: postgres.Sql | postgres.TransactionSql,
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

  const [claimed] = await tx`SELECT set_config('role', 'service_role', true), public.claim_voice_segment_projection(${segment}) AS result`
  const payload = tx.json({
    behavioral_facts: params.behavioralFacts,
    operational_facts: [],
    category_codes: [],
    restricted_medical: [],
    proposed_tasks: [],
  })
  await tx`SELECT public.complete_voice_segment_projection(${segment}, ${claimed.result.token}, ${payload}::jsonb)`
  await tx`RESET ROLE`
  return segment
}

describe('Mergowanie raportów dobowych z notatki ogólnej i notatki podopiecznego', () => {
  it.each(['nagranie ogólne najpierw', 'notatka o podopiecznym najpierw'])(
    'łączy źródła dwóch osób w jeden szkic (%s) @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS', async (order) => {
    await sql.begin(async (tx) => {
      const org = randomUUID()
      const author = randomUUID()
      const appAuthor = randomUUID()
      const resident = randomUUID()
      // W Warszawie jest już 25 listopada, mimo że UTC nadal wskazuje 24 listopada.
      const recordedAt = '2026-11-24T23:59:00Z'
      const generatedAt = '2026-11-25T00:01:00Z'

      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture shared daily report')`
      await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
        SELECT id, 'authenticated', 'authenticated', jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid)
        FROM unnest(${[author, appAuthor]}::uuid[]) AS u(id)`
      await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
        VALUES (${resident}, ${org}, 'Anna', 'Testowa')`

      const segment1 = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident,
        recordedAt,
        behavioralFacts: ['Zjadła całe śniadanie.'],
      })
      const segment2 = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident,
        recordedAt,
        behavioralFacts: ['Wieczorem rozmawiała z bliskimi.'],
      })

      await tx`SET LOCAL ROLE authenticated`
      const assumeNurse = (id: string) => tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: id, role: 'authenticated', aal: 'aal2', session_id: randomUUID(),
        app_metadata: { role: 'nurse', organization_id: org },
      })}, true)`
      const review = async (id: string) => {
        await assumeNurse(author)
        const [result] = await tx`SELECT public.review_voice_family_facts(${id}, true) AS report_id`
        return result.report_id
      }
      const generalFirst = order === 'nagranie ogólne najpierw'
      const firstReportId = generalFirst ? await review(segment1) : null

      await assumeNurse(appAuthor)
      const [draft] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${appAuthor}, 'local-pending-storage', 'Po południu spacerowała po ogrodzie.')
        RETURNING id`

      const [appRes] = await tx`SELECT public.process_voice_draft_atomic(
        ${draft.id},
        ${resident},
        ${appAuthor},
        ${tx.json({ draft_id: draft.id, medical: null, medication_event: 'none' })},
        ${tx.json({
          draft_id: draft.id,
          text: `Po południu spacerowała po ogrodzie.\n\n${AI_DISCLOSURE}`,
          requires_staff_review: true,
        })},
        'test', 'test', ${generatedAt}
      ) AS res`

      const reportId = firstReportId ?? appRes.res.report_id
      expect(appRes.res.report_id).toBe(reportId)
      if (!generalFirst) expect(await review(segment1)).toBe(reportId)
      expect(await review(segment2)).toBe(reportId)

      await tx.savepoint(async (scope) => {
        // Współautorstwo raportu nie daje dostępu do cudzego źródła.
        await expect(scope`SELECT public.process_voice_draft_atomic(
          ${draft.id}, ${resident}, ${author}, '{}'::jsonb, '{}'::jsonb
        )`).rejects.toMatchObject({ code: '42501' })
        throw rollback
      }).catch((error: unknown) => { if (error !== rollback) throw error })

      await tx`RESET ROLE`
      const reports = await tx`SELECT id, author_id, status, content FROM public.daily_reports WHERE resident_id = ${resident}`
      expect(reports).toHaveLength(1)
      expect(reports[0].author_id).toBe(generalFirst ? author : appAuthor)
      expect(reports[0].status).toBe('DRAFT')
      expect(reports[0].content.requires_staff_review).toBe(true)
      const [provenance] = await tx`SELECT app_draft_entries, source_segment_ids
        FROM public.family_voice_report_provenance WHERE report_id = ${reportId}`
      expect(provenance.app_draft_entries).toEqual([expect.objectContaining({ draft_id: draft.id, author_id: appAuthor })])
      expect(provenance.source_segment_ids).toEqual(expect.arrayContaining([segment1, segment2]))

      const text = String(reports[0].content.text)
      expect(text).toContain('Zjadła całe śniadanie.')
      expect(text).toContain('Po południu spacerowała po ogrodzie.')
      expect(text).toContain('Wieczorem rozmawiała z bliskimi.')
      expect(text.split(AI_DISCLOSURE).length - 1).toBe(1)

      await tx`UPDATE public.daily_reports SET status = 'PUBLISHED' WHERE id = ${reportId}`
      await tx`SET LOCAL ROLE authenticated`
      const lateAuthor = generalFirst ? appAuthor : author
      await assumeNurse(lateAuthor)
      const [lateDraft] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${lateAuthor}, 'local-pending-storage', 'Jedna późna notatka.') RETURNING id`
      await tx.savepoint(async (scope) => {
        await expect(scope`SELECT public.process_voice_draft_atomic(
          ${lateDraft.id}, ${resident}, ${lateAuthor}, '{}'::jsonb, '{"text":"Późna notatka"}'::jsonb, 'test', 'test', ${generatedAt}
        )`).rejects.toMatchObject({ code: '42501', message: expect.stringContaining('published') })
        throw rollback
      }).catch((error: unknown) => { if (error !== rollback) throw error })

      throw rollback
    }).catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  })

  it('chroni ręczną korektę szkicu w całej sekwencji: ręczna korekta -> kolejna notatka o podopiecznym -> akceptacja kolejnego fragmentu ogólnego @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    await sql.begin(async (tx) => {
      const org = randomUUID()
      const author = randomUUID()
      const resident = randomUUID()
      const nowIso = new Date().toISOString()

      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture manual edit sequence')`
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

      // Krok 1: Ręczna korekta szkicu przez personel
      const manualText = 'Ręcznie zredagowany przez opiekunkę raport dnia — nie nadpisywać.'
      await tx`UPDATE public.daily_reports
        SET content = ${tx.json({ text: manualText })}::jsonb
        WHERE id = ${res1.res.report_id}`

      // Krok 2: Kolejna notatka o podopiecznym — musi uszanować ręczną edycję (nie nadpisywać ani nie resetować odcisku)
      const [draft2] = await tx`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${author}, 'local-pending-storage', 'Popołudnie spędził na czytaniu.')
        RETURNING id`

      await tx`SAVEPOINT sp_app_after_manual`
      let appAfterManualErr: { code?: string; message?: string } | null = null
      try {
        await tx`SELECT public.process_voice_draft_atomic(
          ${draft2.id},
          ${resident},
          ${author},
          ${tx.json({ draft_id: draft2.id, medical: null, medication_event: 'none' })},
          ${tx.json({
            draft_id: draft2.id,
            text: `Popołudnie spędził na czytaniu.\n\n${AI_DISCLOSURE}`,
            requires_staff_review: false,
          })}
        )`
      } catch (err) {
        appAfterManualErr = err as { code?: string; message?: string }
        await tx`ROLLBACK TO SAVEPOINT sp_app_after_manual`
      }
      expect(appAfterManualErr?.message).toContain('VOICE_FAMILY_DRAFT_ALREADY_REVIEWED')

      // Krok 3: Akceptacja kolejnego fragmentu ogólnego — nadal musi odrzucić przebudowę i zachować ręczną korektę
      await tx`SAVEPOINT sp_general_after_manual`
      let generalAfterManualErr: { code?: string; message?: string } | null = null
      try {
        await tx`SELECT public.review_voice_family_facts(${segment2}, true)`
      } catch (err) {
        generalAfterManualErr = err as { code?: string; message?: string }
        await tx`ROLLBACK TO SAVEPOINT sp_general_after_manual`
      }
      expect(generalAfterManualErr?.message).toContain('VOICE_FAMILY_DRAFT_ALREADY_REVIEWED')

      const finalReports = await tx`SELECT id, status, content FROM public.daily_reports WHERE resident_id = ${resident}`
      expect(finalReports).toHaveLength(1)
      expect(finalReports[0].id).toBe(res1.res.report_id)
      expect(finalReports[0].content.text).toBe(manualText)

      throw rollback
    }).catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  })

  it('adoptuje szkice sprzed migracji (bez wpisu w family_voice_report_provenance) z zachowaniem treści, ID oraz ochrony edycji, publikacji i RLS nurse:own @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS @REQ: VOICE-DRAFT-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      const org = randomUUID()
      const author = randomUUID()
      const otherNurse = randomUUID()
      const resUnedited = randomUUID()
      const resEdited = randomUUID()
      const resPublished = randomUUID()
      const resForeign = randomUUID()
      const nowIso = new Date().toISOString()

      await tx`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture pre-migration drafts')`
      await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
        VALUES
          (${author}, 'authenticated', 'authenticated', jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid)),
          (${otherNurse}, 'authenticated', 'authenticated', jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
      await tx`INSERT INTO public.residents (id, organization_id, first_name, last_name)
        VALUES
          (${resUnedited}, ${org}, 'Irena', 'Szkicowa'),
          (${resEdited}, ${org}, 'Zofia', 'Edytowana'),
          (${resPublished}, ${org}, 'Jan', 'Opublikowany'),
          (${resForeign}, ${org}, 'Piotr', 'Obcy')`

      const legacyDraftId = randomUUID()
      const createdTs = nowIso

      // A. Nieedytowany szkic sprzed migracji (brak wiersza w family_voice_report_provenance)
      const [legacyClean] = await tx`INSERT INTO public.daily_reports
        (resident_id, author_id, content, status, ai_generated, created_at, updated_at)
        VALUES (
          ${resUnedited},
          ${author},
          ${tx.json({
            draft_id: legacyDraftId,
            text: `Notatka sprzed migracji o śniadaniu.\n\n${AI_DISCLOSURE}`,
            requires_staff_review: true,
          })},
          'DRAFT',
          true,
          ${createdTs},
          ${createdTs}
        )
        RETURNING id`

      // B. Ręcznie edytowany szkic sprzed migracji (brak draft_id po zapisie z ReportCard, brak provenance)
      const [legacyEdited] = await tx`INSERT INTO public.daily_reports
        (resident_id, author_id, content, status, ai_generated, created_at, updated_at)
        VALUES (
          ${resEdited},
          ${author},
          ${tx.json({ text: 'Ręcznie poprawiony szkic sprzed migracji.' })},
          'DRAFT',
          true,
          ${createdTs},
          ${createdTs}
        )
        RETURNING id`

      // C. Opublikowany raport sprzed migracji (brak provenance)
      const [legacyPublished] = await tx`INSERT INTO public.daily_reports
        (resident_id, author_id, content, status, ai_generated, created_at, updated_at)
        VALUES (
          ${resPublished},
          ${author},
          ${tx.json({ draft_id: randomUUID(), text: 'Opublikowany raport sprzed migracji.' })},
          'PUBLISHED',
          true,
          ${createdTs},
          ${createdTs}
        )
        RETURNING id`

      // D. Szkic sprzed migracji należący do innej opiekunki (nurse:own)
      const [legacyForeign] = await tx`INSERT INTO public.daily_reports
        (resident_id, author_id, content, status, ai_generated, created_at, updated_at)
        VALUES (
          ${resForeign},
          ${otherNurse},
          ${tx.json({ draft_id: randomUUID(), text: 'Szkic innej opiekunki.' })},
          'DRAFT',
          true,
          ${createdTs},
          ${createdTs}
        ) RETURNING id`

      const [provBefore] = await tx`SELECT count(*)::int AS cnt FROM public.family_voice_report_provenance
        WHERE resident_id IN (${resUnedited}, ${resEdited}, ${resPublished}, ${resForeign})`
      expect(provBefore.cnt).toBe(0)

      const segClean = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident: resUnedited,
        recordedAt: nowIso,
        behavioralFacts: ['Po południu grała w szachy.'],
      })
      const segEdited = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident: resEdited,
        recordedAt: nowIso,
        behavioralFacts: ['Spacerowała po korytarzu.'],
      })
      const segPublished = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident: resPublished,
        recordedAt: nowIso,
        behavioralFacts: ['Obejrzał film przyrodniczy.'],
      })
      const segForeign = await createProjectedGeneralSegment(tx, {
        org,
        author,
        resident: resForeign,
        recordedAt: nowIso,
        behavioralFacts: ['Wypił kompot.'],
      })

      await tx`SET LOCAL ROLE authenticated`
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
        sub: author,
        role: 'authenticated',
        aal: 'aal2',
        session_id: randomUUID(),
        app_metadata: { role: 'nurse', organization_id: org },
      })}, true)`

      // A: adopcja szkicu sprzed migracji — ten sam ID, zachowana treść i metadane, brak drugiego wiersza
      const [adopted] = await tx`SELECT public.review_voice_family_facts(${segClean}, true) AS report_id`
      expect(adopted.report_id).toBe(legacyClean.id)

      const cleanReports = await tx`SELECT id, content FROM public.daily_reports WHERE resident_id = ${resUnedited}`
      expect(cleanReports).toHaveLength(1)
      expect(cleanReports[0].id).toBe(legacyClean.id)
      expect(cleanReports[0].content.draft_id).toBe(legacyDraftId)
      expect(cleanReports[0].content.requires_staff_review).toBe(true)
      expect(String(cleanReports[0].content.text)).toContain('Notatka sprzed migracji o śniadaniu.')
      expect(String(cleanReports[0].content.text)).toContain('Po południu grała w szachy.')
      expect(String(cleanReports[0].content.text).split(AI_DISCLOSURE).length - 1).toBe(1)

      // B: ochrona edycji dla szkicu sprzed migracji
      await tx`SAVEPOINT sp_legacy_edited`
      let legacyEditErr: { message?: string } | null = null
      try {
        await tx`SELECT public.review_voice_family_facts(${segEdited}, true)`
      } catch (err) {
        legacyEditErr = err as { message?: string }
        await tx`ROLLBACK TO SAVEPOINT sp_legacy_edited`
      }
      expect(legacyEditErr?.message).toContain('VOICE_FAMILY_DRAFT_ALREADY_REVIEWED')
      const [editedAfter] = await tx`SELECT content FROM public.daily_reports WHERE id = ${legacyEdited.id}`
      expect(editedAfter.content.text).toBe('Ręcznie poprawiony szkic sprzed migracji.')

      // C: ochrona publikacji dla raportu sprzed migracji
      await tx`SAVEPOINT sp_legacy_pub`
      let legacyPubErr: { message?: string } | null = null
      try {
        await tx`SELECT public.review_voice_family_facts(${segPublished}, true)`
      } catch (err) {
        legacyPubErr = err as { message?: string }
        await tx`ROLLBACK TO SAVEPOINT sp_legacy_pub`
      }
      expect(legacyPubErr?.message).toContain('VOICE_FAMILY_DRAFT_ALREADY_REVIEWED')
      const pubReports = await tx`SELECT id, status FROM public.daily_reports WHERE resident_id = ${resPublished}`
      expect(pubReports).toEqual([{ id: legacyPublished.id, status: 'PUBLISHED' }])

      // D: wspólne dopisanie przez RPC, z zachowaniem bezpośredniej izolacji nurse:own.
      const [foreign] = await tx`SELECT public.review_voice_family_facts(${segForeign}, true) AS report_id`
      expect(foreign.report_id).toBe(legacyForeign.id)
      expect(await tx`SELECT id FROM public.daily_reports WHERE id = ${legacyForeign.id}`).toEqual([])
      await tx`RESET ROLE`
      const [shared] = await tx`SELECT content FROM public.daily_reports WHERE id = ${legacyForeign.id}`
      expect(shared.content.text).toContain('Szkic innej opiekunki.')
      expect(shared.content.text).toContain('Wypił kompot.')

      throw rollback
    }).catch((error: unknown) => {
      if (error !== rollback) throw error
    })
  })

  it('koordynuje równoległy pierwszy zapis na dwóch połączeniach wspólną blokadą podopieczny-dzień @REQ: REPORT-APPROVAL @REQ: VOICE-DOCK-REPORTS @REQ: VOICE-RESIDENT-ASSIGN', async () => {
    const conn1 = postgres(database.toString(), { max: 1, prepare: false })
    const conn2 = postgres(database.toString(), { max: 1, prepare: false })
    const org = randomUUID()
    const author = randomUUID()
    const resident = randomUUID()
    const nowIso = new Date().toISOString()

    try {
      await sql`INSERT INTO public.organizations (id, name) VALUES (${org}, 'Fixture concurrent first write')`
      await sql`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
        VALUES (${author}, 'authenticated', 'authenticated',
          jsonb_build_object('role', 'nurse', 'organization_id', ${org}::uuid))`
      await sql`INSERT INTO public.residents (id, organization_id, first_name, last_name)
        VALUES (${resident}, ${org}, 'Kazimierz', 'Równoległy')`

      const segment = await sql.begin((setupTx) =>
        createProjectedGeneralSegment(setupTx, {
          org,
          author,
          resident,
          recordedAt: nowIso,
          behavioralFacts: ['Zjadł drugie śniadanie.'],
        })
      )
      const [draft] = await sql`INSERT INTO public.voice_draft_notes (resident_id, nurse_id, audio_url, transcript)
        VALUES (${resident}, ${author}, 'local-pending-storage', 'Uczestniczył w gimnastyce porannej.')
        RETURNING id`

      const claims = JSON.stringify({
        sub: author,
        role: 'authenticated',
        aal: 'aal2',
        session_id: randomUUID(),
        app_metadata: { role: 'nurse', organization_id: org },
      })

      let notifyConn1Locked!: () => void
      const conn1Locked = new Promise<void>((resolve) => {
        notifyConn1Locked = resolve
      })

      // Połączenie 1 otwiera transakcję, wywołuje review_voice_family_facts (pierwszy zapis)
      // i wstrzymuje commit na 80 ms, podczas gdy połączenie 2 startuje równolegle process_voice_draft_atomic.
      const tx1Promise = conn1.begin(async (tx1) => {
        await tx1`SET LOCAL ROLE authenticated`
        await tx1`SELECT set_config('request.jwt.claims', ${claims}, true)`
        const [rev] = await tx1`SELECT public.review_voice_family_facts(${segment}, true) AS report_id`
        notifyConn1Locked()
        await new Promise((r) => setTimeout(r, 80))
        return rev.report_id as string
      })

      const tx2Promise = (async () => {
        await conn1Locked
        return conn2.begin(async (tx2) => {
          await tx2`SET LOCAL ROLE authenticated`
          await tx2`SELECT set_config('request.jwt.claims', ${claims}, true)`
          const [app] = await tx2`SELECT public.process_voice_draft_atomic(
            ${draft.id},
            ${resident},
            ${author},
            ${tx2.json({ draft_id: draft.id, medical: null, medication_event: 'none' })},
            ${tx2.json({
              draft_id: draft.id,
              text: `Uczestniczył w gimnastyce porannej.\n\n${AI_DISCLOSURE}`,
              requires_staff_review: false,
            })},
            'model',
            'v1',
            ${nowIso}
          ) AS res`
          return app.res.report_id as string
        })
      })()

      const [reportId1, reportId2] = await Promise.all([tx1Promise, tx2Promise])
      expect(reportId2).toBe(reportId1)

      const reports = await sql`SELECT id, status, content FROM public.daily_reports WHERE resident_id = ${resident}`
      expect(reports).toHaveLength(1)
      expect(reports[0].id).toBe(reportId1)
      expect(String(reports[0].content.text)).toContain('Zjadł drugie śniadanie.')
      expect(String(reports[0].content.text)).toContain('Uczestniczył w gimnastyce porannej.')
      expect(String(reports[0].content.text).split(AI_DISCLOSURE).length - 1).toBe(1)
    } finally {
      await conn1.end()
      await conn2.end()
      await sql.begin(async (cleanup) => {
        await cleanup`SELECT set_config('audit.allow_redact', 'true', true)`
        await cleanup`DELETE FROM public.voice_captures WHERE organization_id = ${org}`
        await cleanup`DELETE FROM public.organizations WHERE id = ${org}`
        await cleanup`DELETE FROM auth.users WHERE id = ${author}`
      })
    }
  })
})
