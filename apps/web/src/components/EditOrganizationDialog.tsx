'use client'

import React, { useState, useTransition } from 'react'
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
import { updateOrganizationAction } from '@/actions/organizations'
import { Pencil, AlertCircle } from 'lucide-react'

interface EditOrganizationDialogProps {
  organization: {
    organization_id: string
    organization_name: string
    address?: string | null
    resident_limit: number
  }
  trigger?: React.ReactNode
  onSuccess?: () => void
}

export function EditOrganizationDialog({
  organization,
  trigger,
  onSuccess,
}: EditOrganizationDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [orgName, setOrgName] = useState(organization.organization_name)
  const [address, setAddress] = useState(organization.address || '')
  const [residentLimit, setResidentLimit] = useState(String(organization.resident_limit))
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setOrgName(organization.organization_name)
      setAddress(organization.address || '')
      setResidentLimit(String(organization.resident_limit))
      setError(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!orgName.trim()) {
      setError('Nazwa placówki jest wymagana.')
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set('organizationId', organization.organization_id)
      formData.set('orgName', orgName.trim())
      formData.set('address', address.trim())
      formData.set('residentLimit', residentLimit.trim())

      const result = await updateOrganizationAction(formData)

      if (result?.error) {
        setError(result.error)
      } else if (result?.success) {
        setOpen(false)
        onSuccess?.()
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : (
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Pencil className="h-3.5 w-3.5" />
          Edytuj
        </Button>
      )}>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edycja danych placówki</DialogTitle>
          <DialogDescription>
            Zmiana nazwy, adresu z asystą Google Places oraz limitu miejsc dla podopiecznych.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-org-name">Nazwa placówki *</Label>
            <Input
              id="edit-org-name"
              placeholder="np. Dom Seniora Złota Jesień"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-address">Adres placówki</Label>
            <AddressAutocompleteInput
              id="edit-org-address"
              value={address}
              onChange={setAddress}
              placeholder="np. ul. Leśna 10, 00-001 Warszawa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-org-limit">Limit podopiecznych</Label>
            <Input
              id="edit-org-limit"
              type="number"
              min="1"
              max="10000"
              placeholder="50"
              value={residentLimit}
              onChange={(e) => setResidentLimit(e.target.value)}
              required
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
              {isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
