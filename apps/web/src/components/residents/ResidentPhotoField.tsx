'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import { setResidentPhotoAction } from '@/actions/resident-photo'
import { RESIDENT_PHOTO_BUCKET, residentPhotoPath } from '@/lib/resident-photo'

const ACCEPT = 'image/webp,image/jpeg,image/png'

/**
 * Zdjęcie podopiecznego w oknie „Edytuj” (SC-ADM-25, @REQ: ADM-RESIDENT-PHOTO). Plik jest zmniejszany w przeglądarce,
 * wgrywany sesją kierownika do prywatnego bucketu (polityki storage sprawdzają rolę i placówkę), a akcja serwera
 * ustawia photo_path i zapisuje audyt. Zapis następuje od razu po wybraniu pliku.
 */
export function ResidentPhotoField({ residentId }: { residentId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus(null)
    startTransition(async () => {
      try {
        const { optimizeImageForUpload } = await import('@/lib/image-optimizer')
        const { file: optimized } = await optimizeImageForUpload(file, { maxWidth: 400, maxHeight: 400, quality: 0.85, prefix: 'zdjecie' })
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        const orgId = data.user?.app_metadata?.organization_id as string | undefined
        if (!orgId) throw new Error('org')
        const ext = optimized.type === 'image/png' ? 'png' : optimized.type === 'image/jpeg' ? 'jpg' : 'webp'
        const path = residentPhotoPath(orgId, residentId, `${crypto.randomUUID()}.${ext}`)
        const { error } = await supabase.storage.from(RESIDENT_PHOTO_BUCKET).upload(path, optimized, { contentType: optimized.type, upsert: false })
        if (error) throw new Error('upload')
        const res = await setResidentPhotoAction(residentId, path)
        if (!res.success) {
          await supabase.storage.from(RESIDENT_PHOTO_BUCKET).remove([path])
          setStatus({ ok: false, text: res.error || 'Nie udało się zapisać zdjęcia.' })
          return
        }
        setStatus({ ok: true, text: 'Zapisano zdjęcie' })
        router.refresh()
      } catch {
        setStatus({ ok: false, text: 'Nie udało się wgrać zdjęcia. Spróbuj ponownie.' })
      }
    })
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="edit-photo" className="text-sm font-medium text-foreground">Zdjęcie podopiecznego</Label>
      <label className="flex min-h-touch cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground hover:bg-muted/40">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {isPending ? 'Zapisywanie zdjęcia…' : 'Wybierz zdjęcie (JPG, PNG, WebP)'}
        <input id="edit-photo" type="file" accept={ACCEPT} className="sr-only" onChange={onFile} disabled={isPending} />
      </label>
      {status && (
        <p role={status.ok ? 'status' : 'alert'} className={`text-sm ${status.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {status.text}
        </p>
      )}
    </div>
  )
}
