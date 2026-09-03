'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ImagePlus, Loader2, Check } from 'lucide-react'
import { Button } from './ui/button'

export function MediaUploader({ residentId }: { residentId: string }) {
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setSuccess(false)
    
    try {
      // Wgraj plik do bucketa
      const fileExt = file.name.split('.').pop()
      const fileName = `${residentId}/${Date.now()}.${fileExt}`
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('resident-media')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Zapisz wpis w resident_media
      const { error: dbError } = await supabase
        .from('resident_media')
        .insert({
          resident_id: residentId,
          storage_path: uploadData.path,
          content_type: file.type
        })

      if (dbError) throw dbError
      
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Błąd wgrywania zdjęcia:', error)
      alert('Wystąpił błąd podczas wgrywania zdjęcia.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
        ref={fileInputRef}
      />
      <Button 
        variant="outline" 
        className="w-full sm:w-auto" 
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <span className="cursor-pointer flex items-center gap-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4 text-green-600" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? 'Wgrywanie...' : success ? 'Wgrano pomyślnie' : 'Dodaj zdjęcie do galerii'}
        </span>
      </Button>
    </div>
  )
}
