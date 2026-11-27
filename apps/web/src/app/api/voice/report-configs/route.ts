import { NextResponse } from 'next/server'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { validateReportText } from '@silvercare/contracts/src/validation'
import { withAuth } from '@/lib/api-auth'
import { assertOrgFeatureForApi, isOrgFeatureEnabled } from '@/lib/feature-flags'
import { redactVoiceTranscript } from '@/lib/voice-redactor'

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const route = '/api/voice/report-configs'
const defaults = OPERATIONAL_REPORT_ENGINE.defaultCategories[0]
const retention = OPERATIONAL_REPORT_ENGINE.reportRetention

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function fail(code: string, status = 400) {
  return NextResponse.json({ code }, { status })
}

function fromDatabase(error: { code: string }) {
  if (error.code === '42501') return fail('REPORT_CONFIGS_FORBIDDEN', 403)
  if (error.code === '22023' || error.code === '23514') return fail('INVALID_REPORT_CONFIGURATION')
  return fail('REPORT_CONFIGS_UNAVAILABLE', 500)
}

async function objectBody(request: Request): Promise<Record<string, unknown> | null> {
  const value: unknown = await request.json().catch(() => null)
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function allowedArray(value: unknown, options: readonly string[]): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === 'string' && options.includes(item))
    && new Set(value).size === value.length
}

function getDelegatedFields(input: Record<string, unknown>, useDefaults: boolean) {
  const schedule = input.schedule_mode === undefined && useDefaults ? defaults.defaultSchedule : input.schedule_mode
  const sections = input.allowed_sections === undefined && useDefaults ? defaults.defaultSections : input.allowed_sections
  const recipients = input.recipient_roles === undefined && useDefaults ? defaults.defaultRecipientRoles : input.recipient_roles
  const enabled = input.is_enabled === undefined && useDefaults ? true : input.is_enabled
  const days = input.retention_days === undefined ? retention.defaultDays : input.retention_days
  if (typeof input.category_code !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(input.category_code)
    || typeof schedule !== 'string' || !(OPERATIONAL_REPORT_ENGINE.allowedSchedules as readonly string[]).includes(schedule)
    || typeof enabled !== 'boolean'
    || !allowedArray(sections, OPERATIONAL_REPORT_ENGINE.allowedSections)
    || !allowedArray(recipients, OPERATIONAL_REPORT_ENGINE.allowedRecipientRoles) || !recipients.length
    || typeof days !== 'number' || !Number.isInteger(days) || days < retention.minDays || days > retention.maxDays) return null
  return {
    p_category_code: input.category_code,
    p_is_enabled: String(enabled),
    p_schedule_mode: schedule,
    p_allowed_sections_json: JSON.stringify(sections),
    p_recipient_roles_json: JSON.stringify(recipients),
    p_retention_days: String(days),
  }
}

function validatedText(value: unknown, maxLength: number, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maxLength || (!allowEmpty && !value.trim())) return false
  const redacted = redactVoiceTranscript(value)
  return !redacted.hasPii && !redacted.hasMedicalData && validateReportText(value).valid
}

export const GET = withAuth(async (request, { supabase, user }) => {
  const organizationId = user.role === 'super_admin'
    ? request.nextUrl.searchParams.get('organizationId')
    : user.organizationId
  if (!isUuid(organizationId)) return fail('INVALID_ORGANIZATION_ID')
  if (user.role === 'super_admin') {
    if (!await isOrgFeatureEnabled(supabase, organizationId, OPERATIONAL_REPORT_ENGINE.moduleKey)) {
      return fail('FEATURE_DISABLED_FOR_ORG', 403)
    }
  } else {
    const blocked = await assertOrgFeatureForApi(supabase, user.rawUser as Parameters<typeof assertOrgFeatureForApi>[1], route)
    if (blocked) return blocked
  }
  const { data, error } = await supabase.rpc('get_organization_report_configs', { p_org_id: organizationId })
  if (error) return fromDatabase(error)
  return NextResponse.json({ configs: data ?? [] })
}, { roles: ['org_admin', 'nurse', 'super_admin'], blockImpersonation: true })

export const POST = withAuth(async (request, { supabase }) => {
  const input = await objectBody(request)
  if (!input || !isUuid(input.organizationId)) return fail('INVALID_ORGANIZATION_ID')
  const fields = getDelegatedFields(input, true)
  const hint = input.classifier_hint === undefined ? '' : input.classifier_hint
  const approval = input.requires_approval === undefined ? defaults.requiresApproval : input.requires_approval
  const archived = input.archived_at
  if (!fields || typeof input.category_label !== 'string' || !validatedText(input.category_label, 160)
    || typeof hint !== 'string' || !validatedText(hint, 800, true) || typeof approval !== 'boolean'
    || (archived != null && (typeof archived !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(archived)
      || !Number.isFinite(Date.parse(archived))))) return fail('INVALID_REPORT_CONFIGURATION')
  if (!await isOrgFeatureEnabled(supabase, input.organizationId, OPERATIONAL_REPORT_ENGINE.moduleKey)) {
    return fail('FEATURE_DISABLED_FOR_ORG', 403)
  }
  const { data, error } = await supabase.rpc('upsert_organization_report_category', {
    p_org_id: input.organizationId,
    ...fields,
    p_category_label: input.category_label.trim(),
    p_classifier_hint: hint.trim(),
    p_requires_approval: String(approval),
    ...(typeof archived === 'string' ? { p_archived_at: archived } : {}),
  })
  if (error) return fromDatabase(error)
  return NextResponse.json({ config: data })
}, { roles: ['super_admin'], blockImpersonation: true })

export const PATCH = withAuth(async (request, { supabase, user }) => {
  const input = await objectBody(request)
  if (!input || !isUuid(input.organizationId)) return fail('INVALID_ORGANIZATION_ID')
  if (input.organizationId !== user.organizationId) return fail('REPORT_CONFIGS_FORBIDDEN', 403)
  if (['classifier_hint', 'category_label', 'requires_approval', 'archived_at'].some((key) => key in input)) {
    return fail('REPORT_CONFIG_FIELDS_FORBIDDEN', 403)
  }
  const fields = getDelegatedFields(input, false)
  if (!fields) return fail('INVALID_REPORT_CONFIGURATION')
  if (!await isOrgFeatureEnabled(supabase, input.organizationId, OPERATIONAL_REPORT_ENGINE.delegationFlagKey)) {
    return fail('FEATURE_DISABLED_FOR_ORG', 403)
  }
  const { data, error } = await supabase.rpc('configure_organization_report_category', {
    p_org_id: input.organizationId, ...fields,
  })
  if (error) return fromDatabase(error)
  return NextResponse.json({ config: data })
}, {
  roles: ['org_admin'],
  requireOrganization: true,
  blockImpersonation: true,
  requiredFeature: OPERATIONAL_REPORT_ENGINE.moduleKey,
})
