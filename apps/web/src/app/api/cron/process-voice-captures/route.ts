import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processNextVoiceCapture } from '@/lib/voice-capture-worker'
import { readSpeechConfiguration } from '@/lib/voice-private-speech'

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
    const status = await processNextVoiceCapture(readSpeechConfiguration())
    return NextResponse.json({ status }, { status: status === 'failed' ? 503 : 200 })
  } catch {
    return NextResponse.json({ error: 'VOICE_PROCESSING_UNAVAILABLE' }, { status: 503 })
  }
}
