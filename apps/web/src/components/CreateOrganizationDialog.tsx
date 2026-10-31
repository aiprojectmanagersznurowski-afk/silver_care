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
import { Plus, AlertCircle } from 'lucide-react'
import {
  CreateOrgSuccessBanner,
  CreateOrgSuccessInfo
} from './organizations/CreateOrgSuccessBanner'

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
  const [successInfo, setSuccessInfo] = useState<CreateOrgSuccessInfo | null>(null)

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

  return (
    <>
      {successInfo && (
        <CreateOrgSuccessBanner
          info={successInfo}
          onClose={() => setSuccessInfo(null)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button />}>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj placówkę
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl md:max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle>Utwórz nową placówkę</DialogTitle>
            <DialogDescription>
              Zakładanie placówki razem z kontem pierwszego kierownika placówki.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
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

            <div className="pt-2 border-t border-border space-y-3">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block">
                Dane pierwszego kierownika placówki
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
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
                className="bg-primary text-white hover:bg-primary/90"
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
