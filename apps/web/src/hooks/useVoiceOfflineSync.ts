'use client'

import { useEffect, useCallback } from 'react'
import { flushOfflineVoiceQueue, isOnline, getOfflineVoiceQueue } from '@/lib/voice-offline-queue'
import { toast } from 'sonner'

export function useVoiceOfflineSync() {
  const syncQueue = useCallback(async () => {
    if (!isOnline()) return
    const queue = getOfflineVoiceQueue()
    if (queue.length === 0) return

    const res = await flushOfflineVoiceQueue()
    if (res.synced > 0) {
      toast.success(`Zsynchronizowano zaległe nagrania offline (${res.synced}).`)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    void syncQueue()

    const handleOnline = () => {
      void syncQueue()
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [syncQueue])

  return { syncQueue }
}
