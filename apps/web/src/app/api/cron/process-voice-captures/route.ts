import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processNextVoiceCapture } from '@/lib/voice-capture-worker'
import { readSpeechConfiguration } from '@/lib/voice-private-speech'
import { processNextVoiceProjection } from '@/lib/voice-projection-worker'

export const runtime = 'nodejs'
export const maxDuration = 120
const digest = (key: string) => createHash('sha256').update(key).digest()

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const supplied = request.headers.get('authorization') ?? ''
  if (!secret || !timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const config = readSpeechConfiguration()
    const [capture, projection] = await Promise.allSettled([processNextVoiceCapture(config), processNextVoiceProjection(config)])
    const status = (result: typeof capture) => result.status === 'fulfilled' ? result.value : 'failed'
    const result = { capture: status(capture), projection: status(projection) }
    return NextResponse.json(result, { status: Object.values(result).includes('failed') ? 503 : 200 })
  } catch {
    return NextResponse.json({ error: 'VOICE_PROCESSING_UNAVAILABLE' }, { status: 503 })
  }
}
