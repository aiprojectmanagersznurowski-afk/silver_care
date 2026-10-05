'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImagePlus, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { toast } from 'sonner'
import { optimizeImageForUpload } from '@/lib/image-optimizer'

export function MediaUploader({ residentId }: { residentId: string }) {
  const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const originalFile = e.target.files?.[0]
    if (!originalFile) return

    setErrorMessage(null)
    setStatus('compressing')
    setStatusMessage('Optymalizacja zdjęcia i czyszczenie EXIF...')

    try {
      // 1. Kompresja i czyszczenie metadanych w przeglądarce
      const { file: optimizedFile, originalSize, optimizedSize, savedPercent } = await optimizeImageForUpload(
        originalFile,
        { maxWidth: 1600, maxHeight: 1600, quality: 0.85, prefix: 'res_media' }
      )

      setStatus('uploading')
      setStatusMessage(`Wgrywanie (${Math.round(optimizedSize / 1024)} KB, -${savedPercent}%)...`)

      // 2. Wgraj zoptymalizowany plik do bucketa
      const fileName = `${residentId}/${optimizedFile.name}`
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('resident-media')
        .upload(fileName, optimizedFile)

      if (uploadError) throw uploadError

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Brak autoryzacji użytkownika')

      // 3. Zapisz wpis w resident_media
      const { error: dbError } = await supabase
        .from('resident_media')
        .insert({
          resident_id: residentId,
          storage_path: uploadData.path,
          content_type: optimizedFile.type,
          uploaded_by: user.id
        })

      if (dbError) throw dbError
      
      setStatus('success')
      const msg = savedPercent > 0 ? `Wgrano! Rozmiar zredukowany o ${savedPercent}%` : 'Wgrano pomyślnie'
      setStatusMessage(msg)
      toast.success(msg)
      
      setTimeout(() => {
        setStatus('idle')
        setStatusMessage(null)
      }, 4000)
    } catch (error: any) {
      console.error('Błąd wgrywania zdjęcia:', error)
      setStatus('error')
      const err = error.message || 'Nie udało się wgrać zdjęcia. Spróbuj ponownie.'
      setErrorMessage(err)
      toast.error(err)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const isBusy = status === 'compressing' || status === 'uploading'

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={isBusy}
        className="hidden"
        ref={fileInputRef}
      />
      <Button 
        variant="outline" 
        className="w-full text-xs font-semibold h-10 border-border hover:bg-muted/50" 
        onClick={() => fileInputRef.current?.click()}
        disabled={isBusy}
      >
        <span className="cursor-pointer flex items-center justify-center gap-2">
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : status === 'success' ? (
            <Check className="h-4 w-4 text-foreground" />
          ) : (
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
          )}
          {status === 'compressing'
            ? 'Optymalizacja...'
            : status === 'uploading'
            ? 'Wgrywanie...'
            : status === 'success'
            ? 'Wgrano pomyślnie'
            : 'Dodaj zdjęcie do galerii'}
        </span>
      </Button>

      {statusMessage && status !== 'error' && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive px-1">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}
    </div>
  )
}
