import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { SHIFT_TASK_POLICY } from '@silvercare/contracts/src/generated/facility'
import { createAdminClient } from '@/lib/supabase/admin'
import { processNextVoiceAssignmentPart } from '@/lib/voice-assignment-worker'
import { processNextVoiceCapture } from '@/lib/voice-capture-worker'
import { readSpeechConfiguration } from '@/lib/voice-private-speech'
import { processNextSelectedVoiceOperationalReport, processNextVoiceProjection } from '@/lib/voice-projection-worker'
import { processNextOperationalReport, removeExpiredVoiceStorage } from '@/lib/voice-maintenance-worker'

export const runtime = 'nodejs'
export const maxDuration = 120
const digest = (key: string) => createHash('sha256').update(key).digest()

/** @REQ: NUR-SHIFT-CLOSURE — the existing HTTPS scheduler also prepares due handovers. */
async function refreshDueShiftHandovers() {
  const { data, error } = await createAdminClient().rpc('refresh_due_shift_handovers', {
    p_buffer_minutes: SHIFT_TASK_POLICY.closure.syncBufferMinutes,
  })
  if (error) throw new Error('SHIFT_HANDOVER_REFRESH_FAILED')
  return data > 0 ? 'processed' : 'idle'
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization') ?? ''
  if (!secret || !timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const config = Promise.resolve().then(readSpeechConfiguration)
    const [capture, part, projection, selectedWeb, operational, retention, handover] = await Promise.allSettled([
      config.then(processNextVoiceCapture), config.then(processNextVoiceAssignmentPart), config.then(processNextVoiceProjection),
      config.then(processNextSelectedVoiceOperationalReport),
      processNextOperationalReport(), removeExpiredVoiceStorage(), refreshDueShiftHandovers(),
    ])
    const status = (result: typeof capture) => result.status === 'fulfilled' ? result.value : 'failed'
    const result = { capture: status(capture), part: status(part), projection: status(projection),
      selectedWeb: status(selectedWeb), operational: status(operational), retention: status(retention),
      handover: status(handover) }
    return NextResponse.json(result, { status: Object.values(result).includes('failed') ? 503 : 200 })
  } catch {
    return NextResponse.json({ error: 'VOICE_PROCESSING_UNAVAILABLE' }, { status: 503 })
  }
}
