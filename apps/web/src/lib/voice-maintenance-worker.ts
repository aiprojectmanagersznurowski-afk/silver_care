import { VOICE_RETENTION } from '@silvercare/contracts/src/generated/voice'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateOperationalCategoryReport, type OperationalReportCategory, type VoiceReportRegistry } from '@/lib/voice-report-engine'

interface ReportJob {
  lease_token: string
  organization_id: string
  category_code: string
  period_start: string
  period_end: string
}

interface ReportMaterial {
  category: OperationalReportCategory
  events: { id: string; sanitizedText: string }[]
  registry: VoiceReportRegistry
}

export async function processNextOperationalReport() {
  const admin = createAdminClient()
  const claim = await admin.rpc('claim_due_operational_report')
  if (claim.error) throw new Error('OPERATIONAL_REPORT_CLAIM_FAILED')
  if (!claim.data) return 'idle'
  const job = claim.data as unknown as ReportJob
  let completed = false
  try {
    const response = await admin.rpc('read_operational_report_material', { p_token: job.lease_token })
    if (!response.data || response.error) throw new Error('OPERATIONAL_REPORT_MATERIAL_UNAVAILABLE')
    const { category, events, registry } = response.data as unknown as ReportMaterial
    const generated = await generateOperationalCategoryReport(category, events, registry)
    const result = await admin.rpc('record_generated_operational_report', {
      p_org_id: job.organization_id,
      p_category_code: job.category_code,
      p_period_start: new Date(job.period_start).toISOString(),
      p_period_end: new Date(job.period_end).toISOString(),
      p_source_event_ids_json: JSON.stringify(events.map(({ id }) => id)),
      p_content_json: JSON.stringify(generated.content),
      p_ai_model: generated.ai_model,
      p_ai_prompt_version: generated.ai_prompt_version,
      p_ai_generated_at: new Date().toISOString(),
    })
    completed = !result.error
  } finally {
    const updated = await admin.rpc('complete_operational_report_job', {
      p_token: job.lease_token, p_success: completed,
    })
    if (updated.error) throw new Error('OPERATIONAL_REPORT_RELEASE_FAILED')
  }
  return completed ? 'processed' : 'failed'
}

export async function removeExpiredVoiceStorage() {
  const admin = createAdminClient()
  const [expired, reports] = await Promise.all([
    admin.rpc('expire_voice_captures'),
    admin.rpc('cleanup_expired_operational_reports'),
  ])
  if (expired.error) throw new Error('VOICE_EXPIRATION_FAILED')
  const claim = await admin.rpc('claim_voice_storage_deletions')
  if (claim.error) throw new Error('VOICE_STORAGE_DELETE_CLAIM_FAILED')
  const token = claim.data?.[0]?.lease_token

  if (token) {
    const result = await admin.storage.from(VOICE_RETENTION.storageBucket).remove(claim.data.map(({ path }) => path))
    if (result.error) throw new Error('VOICE_STORAGE_DELETE_FAILED')
    const finished = await admin.rpc('finish_voice_storage_deletions', { p_token: token })
    if (finished.error) throw new Error('VOICE_STORAGE_DELETE_RELEASE_FAILED')
  }
  if (reports.error) throw new Error('OPERATIONAL_REPORT_EXPIRATION_FAILED')
  return token || expired.data ? 'processed' : 'idle'
}
