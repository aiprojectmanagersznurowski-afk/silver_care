'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { OPERATIONAL_REPORT_ENGINE } from '@silvercare/contracts/src/generated/voice'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { TableCard, TableStateRow } from '@/components/patterns/TableCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Database } from '@/types/database.types'

type Config = Database['public']['Tables']['organization_report_configs']['Row']
type EditMode = 'platform' | 'delegated' | 'read-only'
type LoadState = { state: 'loading' | 'error' } | { state: 'loaded'; configs: Config[] }

const engine = OPERATIONAL_REPORT_ENGINE
const scheduleLabels: Record<string, string> = { manual: 'Ręcznie', per_shift: 'Na zmianę', daily: 'Codziennie', weekly: 'Co tydzień' }
const sectionLabels: Record<string, string> = {
  summary: 'Podsumowanie', events: 'Zdarzenia', locations: 'Lokalizacje', action_items: 'Działania', source_quotes: 'Cytaty źródłowe',
}
const recipientLabels: Record<string, string> = { org_admin: 'Kierownik placówki', nurse: 'Personel opiekuńczy' }
const selectClass = 'min-h-touch rounded-md border bg-background px-3'

export function OrganizationReportConfigsPanel({ organizationId, editMode }: { organizationId: string; editMode: EditMode }) {
  const [load, setLoad] = useState<LoadState>({ state: 'loading' })
  const [revision, setRevision] = useState(0)
  const [editing, setEditing] = useState<Config | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const isPlatform = editMode === 'platform'
  const editable = editMode !== 'read-only'

  function refresh() {
    setLoad({ state: 'loading' })
    setRevision((value) => value + 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      try {
        const response = await fetch(`/api/voice/report-configs?organizationId=${encodeURIComponent(organizationId)}`, {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) throw new Error('LOAD_FAILED')
        const { configs } = await response.json() as { configs: Config[] }
        if (!controller.signal.aborted) setLoad({ state: 'loaded', configs })
      } catch {
        if (!controller.signal.aborted) setLoad({ state: 'error' })
      }
    }
    void read()
    return () => controller.abort()
  }, [organizationId, revision])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !editing) return
    const form = new FormData(event.currentTarget)
    const previous = editing === 'new' ? null : editing
    const delegated = {
      organizationId,
      category_code: previous?.category_code ?? form.get('code'),
      is_enabled: form.has('enabled'),
      schedule_mode: form.get('schedule'),
      allowed_sections: form.getAll('sections'),
      recipient_roles: form.getAll('recipients'),
      retention_days: Number(form.get('retention')),
    }
    const input = isPlatform ? {
      ...delegated,
      category_label: form.get('label'),
      classifier_hint: form.get('hint'),
      requires_approval: form.has('approval'),
      archived_at: form.has('archived') ? previous?.archived_at ?? new Date().toISOString() : null,
    } : delegated
    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch('/api/voice/report-configs', {
        method: isPlatform ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        setSaveError(response.status === 403 ? 'Brak uprawnień do zapisania tej kategorii.' : 'Nie udało się zapisać kategorii.')
        return
      }
      setEditing(null)
      refresh()
    } catch {
      setSaveError('Nie udało się połączyć z serwerem.')
    } finally {
      setSaving(false)
    }
  }

  const config = editing && editing !== 'new' ? editing : null
  const defaults = engine.defaultCategories[0]
  return (
    <div className="space-y-4">
      {!editable && <p className="text-sm text-muted-foreground">Delegacja konfiguracji jest wyłączona. Kategorie są dostępne do odczytu.</p>}
      <TableCard title="Kategorie raportów" actions={isPlatform
        ? <Button onClick={() => { setSaveError(''); setEditing('new') }}>Dodaj kategorię</Button> : undefined}>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Kategoria</TableHead><TableHead>Status</TableHead><TableHead>Harmonogram</TableHead>
            <TableHead>Retencja</TableHead>{editable && <TableHead>Działania</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {load.state === 'loading' && <TableStateRow colSpan={editable ? 5 : 4} state="loading" />}
            {load.state === 'error' && <TableStateRow colSpan={editable ? 5 : 4} state="error"
              action={<Button variant="outline" onClick={refresh}>Spróbuj ponownie</Button>} />}
            {load.state === 'loaded' && !load.configs.length && <TableStateRow colSpan={editable ? 5 : 4}
              state="empty" title="Brak kategorii raportów" />}
            {load.state === 'loaded' && load.configs.map((row) => <TableRow key={row.id}>
              <TableCell>{row.category_label}</TableCell>
              <TableCell><StatusBadge tone={row.is_enabled && !row.archived_at ? 'brand' : 'neutral'}>
                {row.archived_at ? 'Archiwalna' : row.is_enabled ? 'Włączona' : 'Wyłączona'}
              </StatusBadge></TableCell>
              <TableCell>{scheduleLabels[row.schedule_mode]}</TableCell>
              <TableCell>{row.retention_days} dni</TableCell>
              {editable && <TableCell>{(isPlatform || !row.archived_at) && <Button variant="outline"
                onClick={() => { setSaveError(''); setEditing(row) }}>Edytuj</Button>}</TableCell>}
            </TableRow>)}
          </TableBody>
        </Table>
      </TableCard>
      {editing && <form key={config?.id ?? editing.toString()} onSubmit={save}
        className="grid gap-3 rounded-lg border p-4">
        {isPlatform && <>
          {!config && <label className="grid gap-1">Kod kategorii<Input name="code" required pattern="[a-z][a-z0-9_]{0,62}" /></label>}
          <label className="grid gap-1">Nazwa kategorii<Input name="label" required maxLength={160} defaultValue={config?.category_label} /></label>
          <label className="grid gap-1">Wskazówka klasyfikatora<Input name="hint" maxLength={800} defaultValue={config?.classifier_hint} /></label>
          <label className="flex min-h-touch items-center gap-2"><input name="approval" type="checkbox" defaultChecked={config?.requires_approval ?? true} />Wymaga zatwierdzenia</label>
          {config && <label className="flex min-h-touch items-center gap-2"><input name="archived" type="checkbox" defaultChecked={Boolean(config.archived_at)} />Archiwalna</label>}
        </>}
        <label className="flex min-h-touch items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={config?.is_enabled ?? true} />Kategoria włączona</label>
        <label className="grid gap-1">Harmonogram<select name="schedule" className={selectClass} defaultValue={config?.schedule_mode ?? defaults.defaultSchedule}>
          {engine.allowedSchedules.map((schedule) => <option key={schedule} value={schedule}>{scheduleLabels[schedule]}</option>)}
        </select></label>
        <label className="grid gap-1">Retencja w dniach<Input name="retention" type="number" step={1} required
          min={engine.reportRetention.minDays} max={engine.reportRetention.maxDays}
          defaultValue={config?.retention_days ?? engine.reportRetention.defaultDays} /></label>
        <fieldset><legend>Sekcje</legend><div className="flex flex-wrap gap-3">
          {engine.allowedSections.map((section) => <label key={section} className="flex min-h-touch items-center gap-2">
            <input name="sections" type="checkbox" value={section}
              defaultChecked={(config?.allowed_sections ?? (defaults.defaultSections as readonly string[])).includes(section)} />
            {sectionLabels[section]}
          </label>)}
        </div></fieldset>
        <fieldset><legend>Odbiorcy</legend><div className="flex flex-wrap gap-3">
          {engine.allowedRecipientRoles.map((role) => <label key={role} className="flex min-h-touch items-center gap-2">
            <input name="recipients" type="checkbox" value={role}
              defaultChecked={(config?.recipient_roles ?? (defaults.defaultRecipientRoles as readonly string[])).includes(role)} />
            {recipientLabels[role]}
          </label>)}
        </div></fieldset>
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>Zapisz kategorię</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Anuluj</Button>
        </div>
      </form>}
    </div>
  )
}
