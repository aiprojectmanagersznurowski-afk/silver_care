import { handleVoiceDeviceUpload } from '@/lib/voice-device-upload'

export const runtime = 'nodejs'
export const maxDuration = 30

export function POST(request: Request) {
  return handleVoiceDeviceUpload(request, 'COMMIT')
}
