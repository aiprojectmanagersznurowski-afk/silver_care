'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Upload, Loader2, Download, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ResidentContractAttachmentProps {
  residentId: string
  initialContractPath?: string | null
  initialContractName?: string | null
}

export function ResidentContractAttachment({
  residentId,
  initialContractPath,
  initialContractName,
}: ResidentContractAttachmentProps) {
  const [contractPath, setContractPath] = useState<string | null>(initialContractPath || null)
  const [contractName, setContractName] = useState<string | null>(initialContractName || null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit rozmiaru 15MB
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Rozmiar pliku przekracza dopuszczalny limit 15 MB.')
      return
    }

    setUploading(true)

    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `contracts/${residentId}/${Date.now()}_${sanitizedName}`

      // 1. Wgranie do bucketa resident-media
      const { error: uploadError } = await supabase.storage
        .from('resident-media')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // 2. Aktualizacja w bazie przez API route
      const res = await fetch(`/api/admin/residents/${residentId}/contract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: storagePath,
          file_name: file.name,
          content_type: file.type || 'application/pdf',
        }),
      })

      const data = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nie udało się zapisać powiązania umowy.')
      }

      setContractPath(storagePath)
      setContractName(file.name)
      toast.success('Dokument umowy został pomyślnie załączony.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Wystąpił błąd podczas wgrywania pliku.'
      toast.error(message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownload = async () => {
    if (!contractPath) return
    setDownloading(true)
    try {
      const { data, error } = await supabase.storage
        .from('resident-media')
        .createSignedUrl(contractPath, 3600)

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || 'Nie udało się wygenerować bezpiecznego łącza do pliku.')
      }

      // Otwórz w nowej karcie
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd pobierania pliku.'
      toast.error(message)
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/residents/${residentId}/contract`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Błąd usuwania umowy.')
      }

      setContractPath(null)
      setContractName(null)
      setDeleteDialogOpen(false)
      toast.success('Załącznik umowy został usunięty.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nie udało się usunąć załącznika.'
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div data-testid="contract-attachment" className="pt-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
      />

      {contractPath ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-sage/30 bg-sage/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-sage/10 text-sage shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-slate truncate">
                  {contractName || 'Załączona umowa pobytu'}
                </p>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              </div>
              <p className="text-xs text-slate-soft">
                Dokument zapisany w bezpiecznym rejestrze placówki
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              data-testid="contract-download-link"
              className="gap-1.5 text-xs text-slate"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-sage" />}
              {downloading ? 'Generowanie...' : 'Podgląd / Pobierz'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5 text-xs text-slate"
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Zmień
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="contract-delete-button"
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed border-slate/20 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate/5 text-slate-soft shrink-0">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate">Brak załącznika umowy</p>
              <p className="text-xs text-slate-soft">
                Załącz podpisany skan umowy (PDF, JPG, PNG do 15 MB)
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="contract-upload-button"
            className="gap-2 text-xs border-sage/40 text-sage hover:bg-sage/10 w-full sm:w-auto"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Wgrywanie dokumentu...' : 'Załącz dokument umowy'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Usuwanie załącznika umowy"
        description="Czy na pewno chcesz usunąć załączony dokument umowy tego pensjonariusza? Operacja usunie powiązanie pliku z kartą podopiecznego."
        confirmLabel="Usuń załącznik"
        cancelLabel="Anuluj"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
