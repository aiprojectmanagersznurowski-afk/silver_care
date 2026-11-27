import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createClient } from '../apps/web/node_modules/@supabase/supabase-js'
import postgres from 'postgres'
import { LoginPage } from './page-objects/LoginPage'
import { StaffMfaPage } from './page-objects/StaffMfaPage'

test('@REQ: SEC-MFA-STAFF - MFA chroni audyt po zalogowaniu i potwierdzenie wystarcza w bieżącej sesji', async ({ page }) => {
  test.setTimeout(90_000)
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('Tests require local Supabase')
  }
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const email = `staff-mfa-${randomUUID()}@example.test`
  const password = `Test-${randomUUID()}!`
  const { data: { user }, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role: 'super_admin' },
  })
  if (!user || error) throw new Error('Cannot create MFA test account')
  let organizationId: string | undefined
  try {
    const org = await admin.from('organizations').insert({ name: 'Test MFA' }).select('id').single()
    if (org.error) throw new Error('Cannot create MFA test facility')
    organizationId = org.data.id

    const client = createClient(url, (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    expect(signInError).toBeNull()
    const audit = await client.from('audit_logs').select('id').limit(1)
    expect(audit.error?.code).toBe('42501')
    const flags = await client.rpc('get_org_feature_flags', { p_org_id: organizationId })
    expect(flags.error).toBeNull()
    expect(flags.data?.length).toBeGreaterThan(0)

    const login = new LoginPage(page)
    const mfa = new StaffMfaPage(page)
    await login.goto()
    await login.login(email, password)
    await page.waitForURL(/\/(?:admin|login\/mfa)(?:[/?]|$)/)
    await mfa.openAudit()
    await mfa.expectChallenge()
    await mfa.enrollTotp()
    await mfa.expectAudit()
    await mfa.openAudit()
    await mfa.expectAudit()
  } finally {
    await admin.auth.admin.deleteUser(user.id)
    if (organizationId) await admin.from('organizations').delete().eq('id', organizationId)
  }
})

test('@REQ: SEC-MFA-STAFF - konto testowe wchodzi do audytu i kolejki głosowej z aal1', async ({ page }) => {
  test.setTimeout(90_000)
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!)
  const database = new URL(process.env.DATABASE_URL!)
  if ([url, database].some((value) => !['127.0.0.1', 'localhost'].includes(value.hostname))) {
    throw new Error('Tests require local Supabase')
  }
  const admin = createClient(url.toString(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const sql = postgres(database.toString(), { prepare: false })
  const email = `staff-mfa-synthetic-${randomUUID()}@example.test`
  const password = `Test-${randomUUID()}!`
  const organizationId = randomUUID()
  let userId: string | undefined
  let original: string | undefined
  try {
    await sql`INSERT INTO public.organizations (id, name) VALUES (${organizationId}, 'Syntetyczna placówka MFA')`
    const { data: { user }, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { role: 'org_admin', organization_id: organizationId },
    })
    if (!user || error || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new Error('Cannot create MFA test account')
    userId = user.id
    const [policy] = await sql`SELECT pg_get_functiondef('private.staff_mfa_disabled_for_tests()'::regprocedure) AS body`
    original = policy.body
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION private.staff_mfa_disabled_for_tests() RETURNS boolean
      LANGUAGE sql STABLE SET search_path = '' RETURN auth.uid() = '${userId}'::uuid
    `)

    const login = new LoginPage(page)
    const mfa = new StaffMfaPage(page)
    await login.goto()
    await login.login(email, password)
    await page.waitForURL(/\/admin(?:[/?]|$)/)
    await mfa.openAudit()
    await mfa.expectAudit()
    await mfa.expectVoiceQueue()

    const client = createClient(url.toString(), (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { session } } = await client.auth.signInWithPassword({ email, password })
    expect(session).toBeTruthy()
    expect((await client.auth.getClaims()).data?.claims.aal).toBe('aal1')
    const response = await page.request.post('/api/voice/assignment', {
      headers: { authorization: `Bearer ${session!.access_token}` }, data: {},
    })
    expect(response.status()).toBe(400)
  } finally {
    if (original) await sql.unsafe(original)
    if (userId) await admin.auth.admin.deleteUser(userId)
    await sql`DELETE FROM public.organizations WHERE id = ${organizationId}`
    await sql.end()
  }
})
