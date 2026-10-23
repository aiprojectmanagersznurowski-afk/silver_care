"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Edit3, Send, Save, X, Sparkles, AlertCircle, Check } from 'lucide-react'
import { analyzeReportCompleteness } from '@/lib/completeness-gate'
import { Textarea } from '@/components/ui/textarea'
import { MedicationAlertBanner } from '@/components/MedicationAlertBanner'

import type { Json } from '@/types/database.types'
import { StatusBadge } from '@/components/patterns/StatusBadge'

export interface ReportItem {
  id: string
  resident_id: string
  created_at: string | null
  status: 'DRAFT' | 'PUBLISHED' | string
  content: Json
  residents?: {
    first_name?: string
    last_name?: string
  } | null
}

export function ReportCard({ report }: { report: ReportItem }) {
  const [isEditing, setIsEditing] = useState(false)
  const rawContent: unknown = report.content
  const contentObj = typeof rawContent === 'object' && rawContent !== null
    ? (rawContent as Record<string, unknown>)
    : (() => {
        try {
          return typeof rawContent === 'string' && rawContent.startsWith('{')
            ? (JSON.parse(rawContent) as Record<string, unknown>)
            : null
        } catch { return null }
      })()
  const parsedText = typeof contentObj?.text === 'string' ? contentObj.text : (typeof rawContent === 'string' ? rawContent : '')
  const [content, setContent] = useState(parsedText)
  const [loading, setLoading] = useState(false)
  const [medConfirmed, setMedConfirmed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const medEvent = contentObj?.medication_event as string | undefined
  const requiresMedConfirm = contentObj?.medication_alert_requires_confirmation === true ||
    contentObj?.requires_medication_confirmation === true ||
    medEvent === 'refused' || medEvent === 'missed'

  const isPublished = report.status === 'PUBLISHED'
  const completeness = analyzeReportCompleteness(content)

  const handlePublish = async () => {
    if (requiresMedConfirm && !medConfirmed) return
    setLoading(true)
    const updatedContent = { ...(contentObj || {}), text: content, medication_confirmed_by_staff: true }
    await supabase.from('daily_reports').update({ status: 'PUBLISHED', content: updatedContent }).eq('id', report.id)
    setLoading(false)
    router.refresh()
  }

  const handleSave = async () => {
    setLoading(true)
    await supabase
      .from('daily_reports')
      .update({ content: { text: content } })
      .eq('id', report.id)
    setIsEditing(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Card className="overflow-hidden" data-testid="report-card">
      <CardHeader className="pb-3 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>
              {report.residents 
                ? `${report.residents.first_name || ''} ${report.residents.last_name || ''}`.trim()
                : 'Podopieczny'
              }
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-0.5">
              Utworzono: {report.created_at ? new Date(report.created_at).toLocaleDateString('pl-PL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }) : '—'}
            </CardDescription>
          </div>

          <div>
            {isPublished ? (
              <StatusBadge tone="brand" data-testid="report-status-published">
                <CheckCircle2 />
                Opublikowany dla rodziny
              </StatusBadge>
            ) : (
              <StatusBadge data-testid="report-status-draft">
                <Clock />
                Szkic do weryfikacji
              </StatusBadge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {isEditing ? (
          <Textarea className="w-full"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Treść raportu..."
            data-testid="report-content-textarea"
          />
        ) : (
          <div className="p-4 bg-muted/30 rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap border border-border" data-testid="report-content-text">
            {content || 'Brak treści raportu.'}
          </div>
        )}

        {requiresMedConfirm && !isPublished && (
          <MedicationAlertBanner
            event={medEvent}
            requiresConfirmation={requiresMedConfirm}
            confirmed={medConfirmed}
            onConfirmChange={setMedConfirmed}
          />
        )}

        {/* Strażnik kompletności raportu opiekuńczego (AI Quality Gate) */}
        {!isPublished && (
          <div className="rounded-xl border border-border bg-muted p-3 space-y-2.5 text-sm" data-testid="completeness-gate">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground flex items-center gap-1.5" data-testid="completeness-score">
                <Sparkles className="w-3.5 h-3.5 text-foreground" />
                Kompletność informacji dla rodziny ({completeness.scorePercent}%)
              </span>
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                completeness.isComplete 
                  ? 'bg-muted text-foreground' 
                  : 'bg-muted text-foreground'
              }`}>
                {completeness.isComplete ? 'Wszystkie kluczowe obszary' : `Brak: ${completeness.missingLabels.join(', ')}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {completeness.dimensions.map((dim) => (
                <div
                  key={dim.id}
                  data-testid={`completeness-dimension-${dim.id}`}
                  className={`p-2 rounded-lg border flex items-center gap-1.5 transition-colors ${
                    dim.isCovered
                      ? 'bg-muted border-border text-foreground'
                      : 'bg-card border-border text-muted-foreground'
                  }`}
                  title={dim.isCovered ? 'Obszar zawarty w raporcie' : dim.suggestion}
                >
                  {dim.isCovered ? (
                    <Check className="w-3.5 h-3.5 text-foreground shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-foreground shrink-0" />
                  )}
                  <span className="truncate">{dim.label}</span>
                </div>
              ))}
            </div>

            {!completeness.isComplete && (
              <p className="text-muted-foreground italic text-sm pt-0.5" data-testid="completeness-suggestion">
                Podpowiedź asystenta: Bliscy najbardziej wyczekują informacji o apetycie, samopoczuciu i aktywności. Możesz uzupełnić treść lub opublikować raport w obecnym kształcie.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {isEditing ? (
            <>
              <Button 
                disabled={loading} 
                onClick={handleSave} 
                className="rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold gap-1.5"
                data-testid="save-report-button"
              >
                <Save className="h-3.5 w-3.5" />
                Zapisz zmiany
              </Button>
              <Button 
                disabled={loading} 
                onClick={() => {
                  setContent(parsedText)
                  setIsEditing(false)
                }} 
                variant="outline"
                className="rounded-xl border-border text-foreground hover:bg-muted/50 text-sm font-medium gap-1.5"
                data-testid="cancel-edit-report-button"
              >
                <X className="h-3.5 w-3.5" />
                Anuluj
              </Button>
            </>
          ) : (
            <>
              {!isPublished && (
                <Button 
                  disabled={loading || (requiresMedConfirm && !medConfirmed)} 
                  onClick={handlePublish} 
                  title={requiresMedConfirm && !medConfirmed ? 'Potwierdź odnotowanie zdarzenia lekowego' : undefined}
                  className="rounded-xl min-h-touch px-4 bg-primary hover:bg-primary/90 text-white text-sm font-semibold gap-1.5 disabled:opacity-50"
                  data-testid="publish-report-button"
                >
                  <Send className="h-3.5 w-3.5" />
                  Zatwierdź i publikuj dla rodziny
                </Button>
              )}
              <Button 
                disabled={loading} 
                onClick={() => setIsEditing(true)} 
                variant="outline"
                className="rounded-xl min-h-touch px-4 border-border text-foreground hover:bg-muted/50 text-sm font-medium gap-1.5"
                data-testid="edit-report-button"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {isPublished ? 'Edytuj treść' : 'Edytuj szkic'}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

