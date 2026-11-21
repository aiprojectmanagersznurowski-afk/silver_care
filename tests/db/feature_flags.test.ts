import { randomUUID } from 'node:crypto'
import { FEATURE_FLAGS, FEATURE_FLAG_POLICY } from '@silvercare/contracts/src/generated/features'
import postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'

const sql = postgres(process.env.DATABASE_URL!, { prepare: false })
type Tx = postgres.TransactionSql
const parent = 'module_residents_management'
const portal = 'module_family_portal'
const auditAction = FEATURE_FLAG_POLICY.auditAction
const rolledBack = Symbol('rolled back')
const rootUser = randomUUID()
const sessionId = randomUUID()

afterAll(() => sql.end())

async function transaction(run: (tx: Tx) => Promise<void>) {
  await sql.begin(async (tx) => {
    await run(tx)
    throw rolledBack
  }).catch((error: unknown) => {
    if (error !== rolledBack) throw error
  })
}

async function asUser(
  tx: Tx, role: string, organizationId: string | null, user = rootUser,
  claims: Record<string, unknown> = {},
) {
  await tx`SET LOCAL ROLE authenticated`
  await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
    sub: user, role: 'authenticated', aal: 'aal2', session_id: sessionId,
    app_metadata: { role, organization_id: organizationId }, ...claims,
  })}, true)`
}

async function asOwner(tx: Tx) {
  await tx`RESET ROLE`
  await tx`SELECT set_config('request.jwt.claims', '{}', true)`
}

async function createOrg(tx: Tx) {
  const [org] = await tx`INSERT INTO public.organizations (name) VALUES ('Test flag modułów') RETURNING id`
  return org.id as string
}

async function createUser(tx: Tx, id = randomUUID()) {
  await tx`INSERT INTO auth.users (id, aud, role, raw_app_meta_data)
    VALUES (${id}, 'authenticated', 'authenticated', '{}'::jsonb)`
  return id
}

async function denied(tx: Tx, statement: (savepoint: Tx) => PromiseLike<unknown>, code = '42501', message?: string) {
  await expect(tx.savepoint(async (savepoint) => statement(savepoint))).rejects.toMatchObject(
    message ? { code, message } : { code },
  )
}

const setFlag = (tx: Tx, org: string, key: string, enabled: boolean) =>
  tx`SELECT public.set_organization_feature_flag(${org}, ${key}, ${enabled})`

const getFlag = async (tx: Tx, org: string, key: string) => {
  const [row] = await tx`SELECT public.has_org_feature(${org}, ${key}) AS enabled`
  return row.enabled
}

async function familyFixture(tx: Tx) {
  const org = await createOrg(tx)
  const family = await createUser(tx)
  const [resident] = await tx`INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
    VALUES (${org}, 'Testowy', 'Podopieczny', ${randomUUID()}) RETURNING id`
  await tx`INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role)
    VALUES (${resident.id}, ${family}, 'SON', 'family')`
  await tx`INSERT INTO resident_media (resident_id, storage_path, content_type, uploaded_by)
    VALUES (${resident.id}, ${randomUUID()}, 'image/jpeg', ${family})`
  await tx`INSERT INTO agenda_items (organization_id, target_date, time, type, title, family_visible)
    VALUES (${org}, CURRENT_DATE, '15:00', 'activity', 'Zajęcia', true)`
  await tx`INSERT INTO family_messages (organization_id, resident_id, relative_user_id, content)
    VALUES (${org}, ${resident.id}, ${family}, 'Wiadomość testowa')`
  const [report] = await tx`INSERT INTO daily_reports (resident_id, author_id, status, content)
    VALUES (${resident.id}, ${rootUser}, 'DRAFT', '{}'::jsonb) RETURNING id`
  return { org, family, resident: resident.id, report: report.id }
}

describe('@REQ: SUP-FEATURE-FLAGS', () => {
  it('odwzorowuje klucze, wartości domyślne i zależności z kontraktu', async () => {
    const rows = await sql`SELECT feature_key, default_enabled, depends_on FROM public.feature_flag_defaults`
    expect([...rows]).toEqual(expect.arrayContaining(FEATURE_FLAGS.map((flag) => ({
      feature_key: flag.key, default_enabled: flag.defaultEnabled, depends_on: [...flag.dependsOn],
    }))))
    expect(rows).toHaveLength(FEATURE_FLAGS.length)
  })

  it('blokuje bezpośrednie mutacje i rezerwuje RPC dla super admina z MFA', () => transaction(async (tx) => {
    const org = await createOrg(tx)
    await createUser(tx, rootUser)
    await asUser(tx, 'super_admin', null)
    await setFlag(tx, org, portal, false)
    for (const role of ['super_admin', 'org_admin', 'nurse', 'legal_guardian', 'family']) {
      await asUser(tx, role, role === 'super_admin' ? null : org)
      await denied(tx, (sp) => sp`INSERT INTO organization_feature_flags VALUES (${org}, ${parent}, false, ${rootUser})`)
      await denied(tx, (sp) => sp`UPDATE organization_feature_flags SET enabled = true WHERE organization_id = ${org}`)
      await denied(tx, (sp) => sp`DELETE FROM organization_feature_flags WHERE organization_id = ${org}`)
      if (role !== 'super_admin') await denied(tx, (sp) => setFlag(sp, org, portal, true))
    }
    await asUser(tx, 'super_admin', null, rootUser, { aal: 'aal1' })
    await denied(tx, (sp) => setFlag(sp, org, portal, true))
  }))

  it('blokuje zapis podczas rzeczywistego podglądu oraz dla claimu impersonator_id', () => transaction(async (tx) => {
    const org = await createOrg(tx)
    await createUser(tx, rootUser)
    const target = await createUser(tx)
    await asUser(tx, 'super_admin', null)
    await tx`SELECT public.log_impersonation_start(${target}, ${org})`
    await denied(tx, (sp) => setFlag(sp, org, portal, false), '42501', 'FEATURE_FLAG_IMPERSONATION_BLOCKED')
    await tx`SELECT public.log_impersonation_stop(${target}, ${org})`
    await setFlag(tx, org, portal, false)
    expect(await getFlag(tx, org, portal)).toBe(false)
    await asUser(tx, 'super_admin', null, rootUser, { impersonator_id: rootUser })
    await denied(tx, (sp) => setFlag(sp, org, portal, true), '42501', 'FEATURE_FLAG_IMPERSONATION_BLOCKED')
  }))

  it('wyłącza zależności atomowo i audytuje zmianę dokładnie raz', () => transaction(async (tx) => {
    const org = await createOrg(tx)
    await createUser(tx, rootUser)
    const children = FEATURE_FLAGS.filter((flag) =>
      flag.defaultEnabled && (flag.dependsOn as readonly string[]).includes(parent)).map((flag) => flag.key)
    await asUser(tx, 'super_admin', null)
    await setFlag(tx, org, parent, false)
    for (const key of children) expect(await getFlag(tx, org, key)).toBe(false)
    await denied(tx, (sp) => setFlag(sp, org, portal, true), '23514', FEATURE_FLAG_POLICY.dependencyErrorCode)
    await setFlag(tx, org, parent, false)
    await setFlag(tx, org, parent, true)
    for (const key of children) expect(await getFlag(tx, org, key)).toBe(false)
    await asOwner(tx)
    const logs = await tx`SELECT payload FROM audit_logs WHERE organization_id = ${org} AND action = ${auditAction}`
    expect(logs).toHaveLength(children.length + 2)
    expect(logs.map((row) => row.payload)).toEqual(expect.arrayContaining([
      ...[parent, ...children].map((feature_key) => ({
        feature_key, previous_value: true, new_value: false, cascade_from: feature_key === parent ? null : parent,
      })),
      { feature_key: parent, previous_value: false, new_value: true, cascade_from: null },
    ]))
  }))

  it('odmawia anon i nie ujawnia stanu obcej placówki', () => transaction(async (tx) => {
    const org = await createOrg(tx)
    const otherOrg = await createOrg(tx)
    await tx`SET LOCAL ROLE anon`
    await denied(tx, (sp) => getFlag(sp, otherOrg, portal))
    await asUser(tx, 'family', org)
    expect(await getFlag(tx, org, portal)).toBe(true)
    expect(await getFlag(tx, otherOrg, portal)).toBe(false)
    expect(await getFlag(tx, org, 'unknown')).toBe(false)
    await asUser(tx, 'super_admin', null)
    expect(await getFlag(tx, otherOrg, portal)).toBe(true)
    await tx`SET LOCAL ROLE service_role`
    await tx`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true)`
    expect(await getFlag(tx, otherOrg, portal)).toBe(true)
  }))

  it('blokuje odczyty i kolejkę portalu w jednej placówce, z zachowaniem audytu i izolacji', () => transaction(async (tx) => {
    await createUser(tx, rootUser)
    const a = await familyFixture(tx)
    const b = await familyFixture(tx)
    await asUser(tx, 'super_admin', null)
    await setFlag(tx, a.org, portal, false)
    await asOwner(tx)
    await tx`UPDATE daily_reports SET status = 'PUBLISHED' WHERE id IN (${a.report}, ${b.report})`
    const outbox = await tx`SELECT entity_id FROM outbox_notifications WHERE entity_id IN (${a.report}, ${b.report})`
    expect([...outbox]).toEqual([{ entity_id: b.report }])
    const [audit] = await tx`SELECT action FROM audit_logs WHERE organization_id = ${a.org} AND action = ${auditAction}`
    expect(audit.action).toBe(auditAction)
    for (const [fixture, expected] of [[a, 0], [b, 1]] as const) {
      await asUser(tx, 'family', fixture.org, fixture.family)
      expect(await tx`SELECT id FROM daily_reports WHERE id = ${fixture.report}`).toHaveLength(expected)
      expect(await tx`SELECT id FROM family_messages WHERE organization_id = ${fixture.org}`).toHaveLength(expected)
      expect(await tx`SELECT id FROM agenda_items WHERE organization_id = ${fixture.org}`).toHaveLength(expected)
      expect(await tx`SELECT id FROM resident_media WHERE resident_id = ${fixture.resident}`).toHaveLength(expected)
      expect(await tx`SELECT id FROM public.get_family_resident_overview()`).toHaveLength(expected)
    }
  }))
  it('zwraca komplet efektywnych flag już przy aal1 i odmawia obcej placówce', () => transaction(async (tx) => {
    await createUser(tx, rootUser)
    const org = await createOrg(tx)
    const otherOrg = await createOrg(tx)
    await asUser(tx, 'super_admin', null)
    await setFlag(tx, org, parent, false)
    await asUser(tx, 'super_admin', null, rootUser, { aal: 'aal1' })
    const rows = await tx`SELECT * FROM public.get_org_feature_flags(${org})`
    expect(rows).toHaveLength(FEATURE_FLAGS.length)
    expect([...rows]).toContainEqual({ feature_key: portal, enabled: false })
    await asUser(tx, 'org_admin', org)
    expect([...(await tx`SELECT * FROM public.get_org_feature_flags(${org})`)]).toEqual([...rows])
    await denied(tx, (sp) => sp`SELECT * FROM public.get_org_feature_flags(${otherOrg})`)
    await asUser(tx, 'invalid', org)
    await denied(tx, (sp) => sp`SELECT * FROM public.get_org_feature_flags(${org})`)
  }))

  it('blokuje tylko wyłączone raporty BI, zachowując wyniki dla aktywnego modułu', () => transaction(async (tx) => {
    await createUser(tx, rootUser)
    const disabled = await createOrg(tx)
    const enabled = await createOrg(tx)
    await asUser(tx, 'super_admin', null)
    await setFlag(tx, disabled, 'module_voice_and_reports', false)
    const calls = [
      ['fn_daily_report', [2026, 11]], ['fn_monthly_summary', [2026, 11]], ['fn_occupancy_kpi', []],
      ['fn_care_level_stats', []], ['fn_contract_end_reasons', []], ['fn_deaths_by_stay_length', []],
      ['fn_admissions_by_month_care_level', []], ['fn_contract_sources', []],
    ] as const
    for (const [fn, dates] of calls) {
      const statement = (sp: Tx, oid: string) => sp.unsafe(
        `SELECT * FROM public.${fn}($1${dates.length ? ', $2, $3' : ''})`, [oid, ...dates],
      )
      await asUser(tx, 'org_admin', enabled)
      await statement(tx, enabled)
      await asUser(tx, 'org_admin', disabled)
      await denied(tx, (sp) => statement(sp, disabled))
    }
  }))

  it('ukrywa dane opasek i zatrzymuje wszystkie ścieżki ingestu po wyłączeniu modułu', () => transaction(async (tx) => {
    await createUser(tx, rootUser)
    const { org, resident } = await familyFixture(tx)
    await tx`INSERT INTO physiological_data_ingest (organization_id, resident_id, metric, value)
      VALUES (${org}, ${resident}, 'steps_total', 1)`
    await asUser(tx, 'org_admin', org)
    expect(await tx`SELECT id FROM physiological_data_ingest WHERE resident_id = ${resident}`).toHaveLength(1)
    await asUser(tx, 'super_admin', null)
    await setFlag(tx, org, 'module_wearables_iot', false)
    await asUser(tx, 'org_admin', org)
    expect(await tx`SELECT id FROM physiological_data_ingest WHERE resident_id = ${resident}`).toHaveLength(0)
    await denied(tx, (sp) => sp`SELECT public.process_ingest_payload(${org}, ${resident}, 'steps_total', 1, 'fixture')`)
    await denied(tx, (sp) => sp`SELECT public.normalize_and_ingest(${org}, ${resident}, 'polar', 'steps_total', '1', 'fixture')`)
    await denied(tx, (sp) => sp`SELECT public.process_ingest_batch(${org}, ${resident}, 'polar', '[]'::jsonb)`)
  }))

})
