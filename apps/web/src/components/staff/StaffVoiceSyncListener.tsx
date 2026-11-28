'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getOfflineQueueStats,
  flushOfflineVoiceQueue,
  isOnline,
  type VoiceQueueStats,
  type VoiceSyncMode,
} from '@/lib/voice-offline-queue'
import { CloudOff, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

// Crossing from the recorder to the admin layout may remount the listener before a request ends.
let syncInProgress = false

export function StaffVoiceSyncListener({ authorId }: { authorId: string }) {
  const [stats, setStats] = useState<VoiceQueueStats>({
    pendingCount: 0, failedCount: 0, blockedResidentCaptureCount: 0, nextResidentRetryAt: null,
  })
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = useCallback(async (mode?: VoiceSyncMode) => {
    if (syncInProgress || !isOnline()) return
    syncInProgress = true
    setIsSyncing(true)
    try {
      const res = await flushOfflineVoiceQueue(undefined, { authorId, mode })
      if (res.synced > 0) {
        toast.success(`Zsynchronizowano nagrania offline (${res.synced}).`)
      } else if (res.failed > 0 && mode !== 'scheduled') {
        toast.error(`Nie udało się wysłać części nagrań (${res.failed}). Sprawdź połączenie.`)
      }
    } catch {
      toast.error('Błąd podczas próby synchronizacji nagrań.')
    } finally {
      syncInProgress = false
      setIsSyncing(false)
    }
  }, [authorId])

  useEffect(() => {
    let active = true
    let retry: ReturnType<typeof setTimeout> | undefined

    const refresh = async () => {
      const data = await getOfflineQueueStats(authorId).catch(() => null)
      if (!active || !data) return
      setStats(data)
      clearTimeout(retry)
      if (data.nextResidentRetryAt !== null && isOnline()) {
        retry = setTimeout(() => void handleSync('scheduled'), Math.max(0, data.nextResidentRetryAt - Date.now()))
      }
    }
    const onQueueChange = () => void refresh()
    const onOnline = () => void handleSync()

    onQueueChange()
    window.addEventListener('sc-offline-queue-change', onQueueChange)
    window.addEventListener('online', onOnline)
    return () => {
      active = false
      clearTimeout(retry)
      window.removeEventListener('sc-offline-queue-change', onQueueChange)
      window.removeEventListener('online', onOnline)
    }
  }, [authorId, handleSync])

  const totalCount = stats.pendingCount + stats.failedCount
  if (totalCount === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 text-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        {stats.failedCount > 0 ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        ) : (
          <CloudOff className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            Oczekujące nagrania offline: {stats.pendingCount}
          </p>
          {stats.blockedResidentCaptureCount > 0 && (
            <p className="text-sm font-medium text-destructive">
              Nagrania wymagające ponowienia: {stats.blockedResidentCaptureCount}
            </p>
          )}
          {stats.failedCount > stats.blockedResidentCaptureCount && (
            <p className="text-sm font-medium text-destructive">
              Wymaga uwagi personelu (błąd wysyłki): {stats.failedCount - stats.blockedResidentCaptureCount}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSync('manual')}
          disabled={isSyncing || !(stats.pendingCount || stats.blockedResidentCaptureCount)}
          className="inline-flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Synchronizuję...' : 'Synchronizuj teraz'}
        </button>
      </div>
    </div>
  )
}
