import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Database Voice Drafts (VOICE-DRAFT-ISOLATION)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string, { prepare: false });
  });

  afterAll(async () => {
    await sql.end();
  });

  it('allows nurse to create and read own draft, but blocks family @REQ: VOICE-DRAFT-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup org & resident as super_admin
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Voice') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash123') RETURNING id`;
      const resId = res[0].id;

      // 2. Insert draft as nurse A
      await tx`SET LOCAL ROLE authenticated`;
      const nurseA = '11111111-1111-1111-1111-111111111111';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseA}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const draft = await tx`INSERT INTO voice_draft_notes (resident_id, nurse_id, audio_url, transcript) VALUES (${resId}, ${nurseA}, 'http://audio1', 'Test transcript') RETURNING id`;
      expect(draft.length).toBe(1);
      
      // Nurse A can read own draft
      const readDraftA = await tx`SELECT * FROM voice_draft_notes WHERE id = ${draft[0].id}`;
      expect(readDraftA.length).toBe(1);

      // 3. Nurse B cannot read Nurse A's draft
      const nurseB = '22222222-2222-2222-2222-222222222222';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseB}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      
      const readDraftB = await tx`SELECT * FROM voice_draft_notes WHERE id = ${draft[0].id}`;
      expect(readDraftB.length).toBe(0); // Should return nothing due to RLS
      
      // 4. Family cannot read draft
      const familySub = '33333333-3333-3333-3333-333333333333';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familySub}", "app_metadata": {"role": "legal_guardian"}}`}, true)`;
      
      const readFamily = await tx`SELECT * FROM voice_draft_notes WHERE id = ${draft[0].id}`;
      expect(readFamily.length).toBe(0);

      await tx`ROLLBACK`;
    });
  });

  it('auto deletes drafts older than 30 days @REQ: VOICE-RETENTION', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Ret') RETURNING id`;
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${org[0].id}, 'Anna', 'Nowak', 'hash456') RETURNING id`;
      
      await tx`SET LOCAL ROLE authenticated`;
      const nurseA = '11111111-1111-1111-1111-111111111111';
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseA}", "app_metadata": {"role": "nurse", "organization_id": "${org[0].id}"}, "aal": "aal2"}`}, true)`;
      
      // Insert old draft (31 days ago)
      const draftOld = await tx`INSERT INTO voice_draft_notes (resident_id, nurse_id, audio_url, transcript, created_at) VALUES (${res[0].id}, ${nurseA}, 'http://old', 'Old', NOW() - INTERVAL '31 days') RETURNING id`;
      
      // Insert new draft (today)
      const draftNew = await tx`INSERT INTO voice_draft_notes (resident_id, nurse_id, audio_url, transcript, created_at) VALUES (${res[0].id}, ${nurseA}, 'http://new', 'New', NOW()) RETURNING id`;
      
      // Trigger cleanup
      await tx`SET LOCAL ROLE postgres`;
      await tx`SELECT public.cleanup_voice_drafts()`;

      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseA}", "app_metadata": {"role": "nurse", "organization_id": "${org[0].id}"}, "aal": "aal2"}`}, true)`;

      const allDrafts = await tx`SELECT id FROM voice_draft_notes WHERE nurse_id = ${nurseA}`;
      expect(allDrafts.map(d => d.id)).not.toContain(draftOld[0].id);
      expect(allDrafts.map(d => d.id)).toContain(draftNew[0].id);

      await tx`ROLLBACK`;
    });
  });

  it('hardens process_voice_draft_atomic: blocks family (42501), foreign p_nurse_id, mismatched p_resident_id, and PUBLISHED report overwrite @REQ: VOICE-DRAFT-ISOLATION @REQ: VOICE-MEDICAL-STRIP', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const org = await tx`INSERT INTO organizations (name) VALUES ('Org RPC Security') RETURNING id`;
      const orgId = org[0].id;
      const otherOrg = await tx`INSERT INTO organizations (name) VALUES ('Org Other') RETURNING id`;
      const otherOrgId = otherOrg[0].id;

      const res1 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash_rpc_1') RETURNING id`;
      const res1Id = res1[0].id;
      const res2 = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Anna', 'Nowak', 'hash_rpc_2') RETURNING id`;
      const res2Id = res2[0].id;

      await tx`SET LOCAL ROLE authenticated`;
      const nurseA = '11111111-1111-1111-1111-111111111111';
      const nurseB = '22222222-2222-2222-2222-222222222222';
      const familySub = '33333333-3333-3333-3333-333333333333';

      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseA}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      const draft = await tx`INSERT INTO voice_draft_notes (resident_id, nurse_id, audio_url, transcript) VALUES (${res1Id}, ${nurseA}, 'http://audio-rpc', 'Transkrypt testowy') RETURNING id`;
      const draftId = draft[0].id;

      // 1. Rola family kończy się odmową 42501
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${familySub}", "app_metadata": {"role": "family", "organization_id": "${orgId}"}}`}, true)`;
      await tx`SAVEPOINT sp_family`;
      let familyErr: { code?: string; message?: string } | null = null;
      try {
        await tx`SELECT public.process_voice_draft_atomic(${draftId}, ${res1Id}, ${familySub}, '{"medical": "x"}'::jsonb, '{"text": "y", "draft_id": "1"}'::jsonb)`;
      } catch (e) {
        familyErr = e as { code?: string; message?: string };
        await tx`ROLLBACK TO SAVEPOINT sp_family`;
      }
      expect(familyErr).not.toBeNull();
      expect(familyErr?.code).toBe('42501');
      expect(familyErr?.message).toContain('Forbidden role for voice processing');

      // 2. Próba podania cudzego p_nurse_id (nurseA podaje nurseB) kończy się odmową 42501
      await tx`SELECT set_config('request.jwt.claims', ${`{"sub": "${nurseA}", "app_metadata": {"role": "nurse", "organization_id": "${orgId}"}, "aal": "aal2"}`}, true)`;
      await tx`SAVEPOINT sp_wrong_nurse`;
      let wrongNurseErr: { code?: string; message?: string } | null = null;
      try {
        await tx`SELECT public.process_voice_draft_atomic(${draftId}, ${res1Id}, ${nurseB}, '{"medical": "x"}'::jsonb, '{"text": "y"}'::jsonb)`;
      } catch (e) {
        wrongNurseErr = e as { code?: string; message?: string };
        await tx`ROLLBACK TO SAVEPOINT sp_wrong_nurse`;
      }
      expect(wrongNurseErr).not.toBeNull();
      expect(wrongNurseErr?.code).toBe('42501');
      expect(wrongNurseErr?.message).toContain('Unauthorized caller: nurse_id must match auth.uid()');

      // 3. Próba podania niezgodnego p_resident_id kończy się odmową 42501
      await tx`SAVEPOINT sp_wrong_res`;
      let wrongResErr: { code?: string; message?: string } | null = null;
      try {
        await tx`SELECT public.process_voice_draft_atomic(${draftId}, ${res2Id}, ${nurseA}, '{"medical": "x"}'::jsonb, '{"text": "y"}'::jsonb)`;
      } catch (e) {
        wrongResErr = e as { code?: string; message?: string };
        await tx`ROLLBACK TO SAVEPOINT sp_wrong_res`;
      }
      expect(wrongResErr).not.toBeNull();
      expect(wrongResErr?.code).toBe('42501');
      expect(wrongResErr?.message).toContain('Draft resident/organization mismatch');

      // 4. Próba podania niezgodnego p_organization_id kończy się odmową 42501
      await tx`SAVEPOINT sp_wrong_org`;
      let wrongOrgErr: { code?: string; message?: string } | null = null;
      try {
        await tx`SELECT public.process_voice_draft_atomic(${draftId}, ${res1Id}, ${nurseA}, '{"medical": "x"}'::jsonb, '{"text": "y"}'::jsonb, 'model', 'v1', NOW(), ${otherOrgId})`;
      } catch (e) {
        wrongOrgErr = e as { code?: string; message?: string };
        await tx`ROLLBACK TO SAVEPOINT sp_wrong_org`;
      }
      expect(wrongOrgErr).not.toBeNull();
      expect(wrongOrgErr?.code).toBe('42501');
      expect(wrongOrgErr?.message).toContain('Draft resident/organization mismatch');

      // 5. Poprawne wykonanie przez właściciela (nurseA)
      const okRes = await tx`SELECT public.process_voice_draft_atomic(
        ${draftId},
        ${res1Id},
        ${nurseA},
        ${tx.json({ draft_id: draftId, medical: 'Brak', medication_event: 'taken' })},
        ${tx.json({ draft_id: draftId, text: 'Raport dla bliskich', requires_staff_review: false })}
      ) AS res`;
      expect(okRes[0].res.success).toBe(true);
      expect(okRes[0].res.idempotent).toBe(false);

      // 6. Blokada nadpisania raportu o statusie PUBLISHED
      const reportId = okRes[0].res.report_id;
      await tx`UPDATE voice_draft_notes SET status = 'DRAFT' WHERE id = ${draftId}`;
      await tx`UPDATE daily_reports SET status = 'PUBLISHED' WHERE id = ${reportId}`;

      await tx`SAVEPOINT sp_overwrite_pub`;
      let overwriteErr: { code?: string; message?: string } | null = null;
      try {
        await tx`SELECT public.process_voice_draft_atomic(
          ${draftId},
          ${res1Id},
          ${nurseA},
          ${tx.json({ draft_id: draftId, medical: 'Nowy' })},
          ${tx.json({ draft_id: draftId, text: 'Nadpisany', requires_staff_review: false })}
        )`;
      } catch (e) {
        overwriteErr = e as { code?: string; message?: string };
        await tx`ROLLBACK TO SAVEPOINT sp_overwrite_pub`;
      }
      expect(overwriteErr).not.toBeNull();
      expect(overwriteErr?.code).toBe('42501');
      expect(overwriteErr?.message).toContain('Cannot overwrite published daily report');

      throw new Error('ROLLBACK');
    }).catch((e: Error) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
