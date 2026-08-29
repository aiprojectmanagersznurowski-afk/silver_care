import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

describe('Database Voice Drafts (VOICE-DRAFT-ISOLATION)', () => {
  let sql: postgres.Sql;

  beforeAll(() => {
    sql = postgres(process.env.DATABASE_URL as string);
  });

  afterAll(async () => {
    await sql.end();
  });

  it('allows nurse to create and read own draft, but blocks family @REQ: VOICE-DRAFT-ISOLATION', async () => {
    await sql.begin(async (tx) => {
      // 1. Setup org & resident as super_admin
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Voice') RETURNING id`;
      const orgId = org[0].id;
      
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${orgId}, 'Jan', 'Kowalski', 'hash123') RETURNING id`;
      const resId = res[0].id;

      // 2. Insert draft as nurse A
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
      await tx`SET LOCAL ROLE authenticated`;
      await tx`SELECT set_config('request.jwt.claims', '{"app_metadata": {"role": "super_admin"}, "aal": "aal2"}', true)`;
      
      const org = await tx`INSERT INTO organizations (name) VALUES ('Org Ret') RETURNING id`;
      const res = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash) VALUES (${org[0].id}, 'Anna', 'Nowak', 'hash456') RETURNING id`;
      
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
});
