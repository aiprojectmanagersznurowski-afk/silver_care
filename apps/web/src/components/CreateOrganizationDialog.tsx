'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AddressAutocompleteInput } from '@/components/AddressAutocompleteInput'
import { createOrganizationAction } from '@/actions/organizations'
import { Building2, Plus, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react'

export function CreateOrganizationDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [orgName, setOrgName] = useState('')
  const [address, setAddress] = useState('')
  const [residentLimit, setResidentLimit] = useState('50')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminFullName, setAdminFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    orgName: string
    adminEmail: string
    inviteUrl?: string | null
    emailSent?: boolean
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!orgName.trim()) {
      setError('Nazwa placówki jest wymagana.')
      return
    }

    if (!adminEmail.trim()) {
      setError('Adres e-mail administratora jest wymagany.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('orgName', orgName.trim())
      formData.set('address', address.trim())
      formData.set('residentLimit', residentLimit.trim() || '50')
      formData.set('adminEmail', adminEmail.trim())
      formData.set('adminFullName', adminFullName.trim())

      const result = await createOrganizationAction(formData)

      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setSuccessInfo({
          orgName: result.orgName || orgName,
          adminEmail: result.adminEmail || adminEmail,
          inviteUrl: result.inviteUrl,
          emailSent: result.emailSent
        })

        // Wyczyść formularz
        setOrgName('')
        setAddress('')
        setResidentLimit('50')
        setAdminEmail('')
        setAdminFullName('')
        setOpen(false)

        // Odśwież widok placówek w tle natychmiast
        router.refresh()
      }
    })
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      {successInfo && (
        <div className="rounded-2xl border border-sage/30 bg-sage/5 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-sage shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate">
                  Placówka „{successInfo.orgName}” została pomyślnie utworzona!
                </p>
                <p className="text-xs text-slate-soft mt-0.5">
                  {successInfo.emailSent
                    ? `Wysłano e-mail z zaproszeniem na adres ${successInfo.adminEmail}.`
                    : `Konto pierwszego administratora (${successInfo.adminEmail}) zostało przygotowane.`
                  }
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="text-xs text-slate-soft hover:text-slate font-medium"
            >
              Zamknij
            </button>
          </div>

          {successInfo.inviteUrl && (
            <div className="pt-2 border-t border-sage/10 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs text-slate-soft font-medium shrink-0">
                Link aktywacyjny:
              </span>
              <input
                readOnly
                value={successInfo.inviteUrl}
                className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-slate/10 flex-1 truncate text-slate"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(successInfo.inviteUrl!)}
                className="h-8 text-xs shrink-0 rounded-lg gap-1.5"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-sage" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Skopiowano' : 'Kopiuj link'}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button />}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj placówkę
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Utwórz nową placówkę</DialogTitle>
            <DialogDescription>
              Atomowy provisioning: zakładanie ośrodka i konta pierwszego administratora (org_admin).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-org-name">Nazwa placówki *</Label>
              <Input
                id="create-org-name"
                placeholder="np. Dom Seniora Złota Jesień"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-org-address">Adres placówki</Label>
              <AddressAutocompleteInput
                id="create-org-address"
                placeholder="np. ul. Leśna 10, 00-001 Warszawa"
                value={address}
                onChange={setAddress}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-org-limit">Limit podopiecznych</Label>
              <Input
                id="create-org-limit"
                type="number"
                min="1"
                max="10000"
                placeholder="50"
                value={residentLimit}
                onChange={e => setResidentLimit(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-org-admin-email">E-mail administratora *</Label>
              <Input
                id="create-org-admin-email"
                type="email"
                placeholder="np. admin@zlotajesien.pl"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-org-admin-name">Imię i nazwisko administratora</Label>
              <Input
                id="create-org-admin-name"
                placeholder="np. Anna Nowak"
                value={adminFullName}
                onChange={e => setAdminFullName(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-sage text-white hover:bg-sage/90"
              >
                {isPending ? 'Tworzenie...' : 'Utwórz placówkę'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
