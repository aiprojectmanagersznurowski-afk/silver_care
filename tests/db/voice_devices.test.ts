import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { createHash, randomBytes } from 'node:crypto';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL as string, { prepare: false });

/**
 * @REQ: VOICE-DEVICE-REGISTRY
 *
 * Rejestr urządzeń nagrywających i stałe przypisanie do pracownika (SC-ADM-24, ADR-022 pkt 4).
 * Rejestruje i unieważnia kierownik placówki; przypisuje kierownik placówki albo kierownik zmiany,
 * która trwa teraz; personel czyta; bliscy i inna placówka nie widzą nic; nic nie jest usuwane.
 * Każdy test w transakcji z ROLLBACK.
 */
type Tx = postgres.TransactionSql;

async function rollback(fn: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await fn(tx);
    throw new Error('ROLLBACK');
  }).catch((e) => {
    if (e.message !== 'ROLLBACK') throw e;
  });
}

const as = (tx: Tx, role: string, orgId?: string, sub?: string) =>
  tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub, app_metadata: { role, organization_id: orgId }, aal: 'aal2' })}, true)`;

async function failsWith(tx: Tx, pattern: RegExp, run: (sp: Tx) => Promise<unknown>) {
  const result = await tx.savepoint(async (sp) => { await run(sp as unknown as Tx); }).then(() => 'zapisano', (e: Error) => e.message);
  expect(result).toMatch(pattern);
}

const tokenHash = () => createHash('sha256').update(randomBytes(32)).digest('hex');

async function seed(tx: Tx) {
  const [org] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Urzadzenia Test') RETURNING id`;
  const [otherOrg] = await tx`INSERT INTO organizations (name) VALUES ('Placowka Urzadzenia Inna') RETURNING id`;
  const mkUser = async (role: string, orgId: string) => {
    const [u] = await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data, raw_user_meta_data)
      VALUES (gen_random_uuid(), 'authenticated', 'authenticated', ${tx.json({ role, organization_id: orgId })}, '{}'::jsonb) RETURNING id`;
    return u.id as string;
  };
  const admin = await mkUser('org_admin', org.id);
  const nurseA = await mkUser('nurse', org.id);
  const nurseB = await mkUser('nurse', org.id);
  const lead = await mkUser('nurse', org.id);
  const foreignAdmin = await mkUser('org_admin', otherOrg.id);
  const foreignNurse = await mkUser('nurse', otherOrg.id);
  await tx`SET LOCAL ROLE authenticated`;
  await as(tx, 'org_admin', org.id, admin);
  const [device] = await tx`INSERT INTO voice_devices (organization_id, label, token_hash) VALUES (${org.id}, 'Stick 01', ${tokenHash()}) RETURNING id`;
  return { orgId: org.id as string, otherOrgId: otherOrg.id as string, admin, nurseA, nurseB, lead, foreignAdmin, foreignNurse, deviceId: device.id as string };
}

/** Zmiana trwająca teraz (Europe/Warsaw), z `lead` jako kierownikiem zmiany. */
async function seedCurrentShiftLead(tx: Tx, orgId: string, admin: string, lead: string) {
  await as(tx, 'org_admin', orgId, admin);
  const [def] = await tx`INSERT INTO shift_definitions (organization_id, code, name, start_time, end_time)
    VALUES (${orgId}, 'NOW', 'Bieżąca',
      ((now() AT TIME ZONE 'Europe/Warsaw') - interval '1 hour')::time,
      ((now() AT TIME ZONE 'Europe/Warsaw') + interval '1 hour')::time) RETURNING id`;
  await tx`INSERT INTO shift_roster (organization_id, shift_definition_id, shift_date, user_id, is_shift_lead)
    VALUES (${orgId}, ${def.id}, ((now() AT TIME ZONE 'Europe/Warsaw') - interval '1 hour')::date, ${lead}, true)`;
}

describe('Rejestr urządzeń i przydział (VOICE-DEVICE-REGISTRY)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('@REQ: VOICE-DEVICE-REGISTRY - kierownik placówki rejestruje urządzenie; etykieta unikalna w placówce; personel czyta, nie rejestruje', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await failsWith(tx, /duplicate key|uq_voice_devices_label/i, (sp) =>
        sp`INSERT INTO voice_devices (organization_id, label, token_hash) VALUES (${s.orgId}, 'Stick 01', ${tokenHash()})`);
      await failsWith(tx, /check constraint|chk_voice_devices_token_hash/i, (sp) =>
        sp`INSERT INTO voice_devices (organization_id, label, token_hash) VALUES (${s.orgId}, 'Stick 02', 'jawny-token')`);

      await as(tx, 'nurse', s.orgId, s.nurseA);
      expect((await tx`SELECT id FROM voice_devices`).length).toBe(1);
      await failsWith(tx, /row-level security|violates|permission denied/i, (sp) =>
        sp`INSERT INTO voice_devices (organization_id, label, token_hash) VALUES (${s.orgId}, 'Stick 03', ${tokenHash()})`);
    });
  }, 30000);

  it('@REQ: VOICE-DEVICE-REGISTRY - inna placówka, bliscy i super admin nie widzą urządzeń ani przydziałów', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await tx`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseA})`;

      for (const [role, org, sub] of [
        ['org_admin', s.otherOrgId, s.foreignAdmin],
        ['legal_guardian', undefined, undefined],
        ['family', undefined, undefined],
        ['super_admin', undefined, undefined],
      ] as const) {
        await as(tx, role, org, sub);
        expect((await tx`SELECT id FROM voice_devices`).length).toBe(0);
        expect((await tx`SELECT id FROM voice_device_assignments`).length).toBe(0);
      }
    });
  }, 30000);

  it('@REQ: VOICE-DEVICE-REGISTRY - unieważnienie przez revoked_at; urządzenia nie da się usunąć; personel nie unieważnia', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.nurseA);
      expect((await tx`UPDATE voice_devices SET revoked_at = now() WHERE id = ${s.deviceId} RETURNING id`).length).toBe(0);

      await as(tx, 'org_admin', s.orgId, s.admin);
      expect((await tx`UPDATE voice_devices SET revoked_at = now() WHERE id = ${s.deviceId} RETURNING id`).length).toBe(1);
      expect((await tx`DELETE FROM voice_devices WHERE id = ${s.deviceId} RETURNING id`).length).toBe(0);
      expect((await tx`SELECT revoked_at FROM voice_devices WHERE id = ${s.deviceId}`)[0].revoked_at).not.toBeNull();

      await failsWith(tx, /VOICE_DEVICE_REVOKED/, (sp) =>
        sp`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseA})`);
    });
  }, 30000);

  it('@REQ: VOICE-DEVICE-REGISTRY - jedno urządzenie ma najwyżej jeden aktywny przydział; zamyka go tylko zwrot', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      const [a] = await tx`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseA}) RETURNING id, started_at`;
      await failsWith(tx, /duplicate key|uq_voice_device_assignments_active/i, (sp) =>
        sp`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseB})`);

      await failsWith(tx, /check constraint|chk_voice_device_assignments_period/i, (sp) =>
        sp`UPDATE voice_device_assignments SET ended_at = started_at - interval '1 minute' WHERE id = ${a.id}`);
      await tx`UPDATE voice_device_assignments SET ended_at = now() + interval '1 second' WHERE id = ${a.id}`;

      await failsWith(tx, /VOICE_DEVICE_ASSIGNMENT_OVERLAP/, (sp) =>
        sp`INSERT INTO voice_device_assignments (organization_id, device_id, user_id, started_at) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseB}, ${a.started_at})`);
      const [b] = await tx`INSERT INTO voice_device_assignments (organization_id, device_id, user_id, started_at)
        VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseB}, now() + interval '2 seconds') RETURNING id`;
      expect(b.id).toBeTruthy();
      expect((await tx`DELETE FROM voice_device_assignments WHERE id = ${a.id} RETURNING id`).length).toBe(0);
    });
  }, 30000);

  it('@REQ: VOICE-DEVICE-REGISTRY - przydział tylko dla personelu tej placówki, w placówce urządzenia', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await failsWith(tx, /VOICE_DEVICE_ASSIGNEE_FOREIGN/, (sp) =>
        sp`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.foreignNurse})`);

      await as(tx, 'org_admin', s.otherOrgId, s.foreignAdmin);
      await failsWith(tx, /row-level security|violates|VOICE_DEVICE_ORG_MISMATCH/i, (sp) =>
        sp`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.otherOrgId}, ${s.deviceId}, ${s.foreignNurse})`);
    });
  }, 30000);

  it('@REQ: VOICE-DEVICE-REGISTRY - kierownik trwającej zmiany przypisuje; zwykły personel czyta przydziały, nie przypisuje', async () => {
    await rollback(async (tx) => {
      const s = await seed(tx);
      await as(tx, 'nurse', s.orgId, s.nurseA);
      await failsWith(tx, /row-level security|violates|permission denied/i, (sp) =>
        sp`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseA})`);

      await seedCurrentShiftLead(tx, s.orgId, s.admin, s.lead);
      await as(tx, 'nurse', s.orgId, s.lead);
      const [a] = await tx`INSERT INTO voice_device_assignments (organization_id, device_id, user_id) VALUES (${s.orgId}, ${s.deviceId}, ${s.nurseB}) RETURNING id`;
      expect((await tx`UPDATE voice_device_assignments SET ended_at = now() + interval '1 second' WHERE id = ${a.id} RETURNING id`).length).toBe(1);

      await as(tx, 'nurse', s.orgId, s.nurseB);
      expect((await tx`SELECT id FROM voice_device_assignments WHERE id = ${a.id}`).length).toBe(1);
      expect((await tx`UPDATE voice_device_assignments SET ended_at = now() WHERE id = ${a.id} RETURNING id`).length).toBe(0);
    });
  }, 30000);
});
