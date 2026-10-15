'use client'

import { useVoiceOfflineSync } from '@/hooks/useVoiceOfflineSync'

export function StaffVoiceSyncListener() {
  useVoiceOfflineSync()
  return null
}
